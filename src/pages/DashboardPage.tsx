import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ChevronRight, Settings } from 'lucide-react';
import { useAppLayoutContext } from '../components/AppLayout';
import TeamCard from '../components/TeamCard';
import MatchComparison from '../components/MatchComparison';
import MatchRevealAnimation from '../components/MatchRevealAnimation';
import MatchList from '../components/MatchList';
import PlayerStandings from '../components/PlayerStandings';
import GameSessions from '../components/GameSessions';
import PlayerTopTeams from '../components/PlayerTopTeams';
import TeamLeaderboard from '../components/TeamLeaderboard';
import PlayerWinMatrix from '../components/PlayerWinMatrix';
import PlayerAchievements from '../components/PlayerAchievements';
import CollapsibleSection from '../components/CollapsibleSection';
import ErrorBoundary from '../components/ErrorBoundary';
import EditTeamModal from '../components/EditTeamModal';
import { LoadingState, ErrorState } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import { getFilterWarning, getStatDifferences } from '../utils/matchDisplay';

export default function DashboardPage() {
  const {
    teams, players, teamsLoading, playersLoading, teamsError, playersError,
    matchesToday, allMatches, loadingToday, loadingAll, errorToday, errorAll,
    match, matchError, isAnimating, pendingMatch, availableTeamsForEdit,
    filteredTeams, filterSettings, openSettings,
    handleAnimationComplete, handleUpdateTeam,
  } = useAppLayoutContext();
  const { user, isAdmin } = useAuth();

  const [editingSlot, setEditingSlot] = useState<0 | 1 | null>(null);

  const initialLoading = teamsLoading || playersLoading;
  const initialError = teamsError || playersError;

  // Wait for today's matches before warning "all played today", or the
  // banner would flash while that query is still in flight.
  const filterWarning = loadingToday ? null : getFilterWarning({
    totalTeams: teams.length,
    filteredCount: filteredTeams.length,
    availableCount: availableTeamsForEdit.length,
    ...filterSettings,
  });

  const differences = useMemo(
    () => (match ? [getStatDifferences(match[0], match[1]), getStatDifferences(match[1], match[0])] as const : null),
    [match]
  );

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 p-4">
      {initialLoading && <LoadingState label="Loading teams..." />}
      {initialError && <ErrorState message={initialError} />}

      {!initialLoading && !initialError && teams.length === 0 && (
        <p className="py-6 text-center text-sm text-gray-500">
          No teams available yet. An admin needs to add some.
        </p>
      )}

      {!initialLoading && !initialError && teams.length > 0 && (
        <>
          {filterWarning && (
            <div role="status" className="flex items-center gap-2 border-2 border-yellow-400 bg-yellow-50 p-2.5">
              <AlertTriangle className="h-4 w-4 flex-none text-yellow-700" aria-hidden="true" />
              <p className="min-w-0 flex-1 text-xs font-bold text-(--color-ink)">{filterWarning.message}</p>
              <button
                onClick={openSettings}
                className="flex h-10 flex-none items-center gap-1 border-2 border-(--color-ink) bg-white px-2.5 text-xs font-bold uppercase tracking-wide text-(--color-ink)"
              >
                <Settings className="h-3.5 w-3.5" />
                Filter
              </button>
            </div>
          )}

          {isAnimating && pendingMatch ? (
            <MatchRevealAnimation
              teams={pendingMatch}
              allTeams={filteredTeams.length > 0 ? filteredTeams : teams}
              onAnimationComplete={handleAnimationComplete}
            />
          ) : match ? (
            <>
              <TeamCard team={match[0]} differences={differences?.[0]} onEdit={isAdmin ? () => setEditingSlot(0) : undefined} />
              <div className="flex items-center gap-2.5">
                <div className="h-0.5 flex-1 bg-(--color-ink)" />
                <div className="flex h-9 w-9 flex-none items-center justify-center border-2 border-(--color-ink) bg-(--color-green-bright) text-xs font-black text-(--color-ink)">
                  VS
                </div>
                <div className="h-0.5 flex-1 bg-(--color-ink)" />
              </div>
              <TeamCard team={match[1]} differences={differences?.[1]} onEdit={isAdmin ? () => setEditingSlot(1) : undefined} />
              <MatchComparison team1={match[0]} team2={match[1]} />
            </>
          ) : filterWarning ? null : (
            <ErrorState message={matchError ?? 'No matchup available yet — tap New Match to generate one.'} />
          )}

          <ErrorBoundary fallbackTitle="Error loading today's matches">
            <CollapsibleSection title="Today's Matches" storageKey="section-todayMatches" badge={matchesToday.length} defaultOpen>
              <MatchList
                matches={matchesToday}
                loading={loadingToday}
                error={errorToday}
                currentUserId={user?.id}
                players={players}
                emptyMessage="No matches recorded today."
              />
              <Link
                to="/matches"
                className="mt-3 flex h-10 items-center justify-center gap-2 border-2 border-(--color-ink) bg-white text-xs font-bold uppercase tracking-wide text-(--color-ink)"
              >
                All matches
                <ChevronRight className="h-4 w-4" />
              </Link>
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading game sessions">
            <CollapsibleSection title="Game Sessions" storageKey="section-gameSessions" defaultOpen={false}>
              <GameSessions
                allMatches={allMatches}
                players={players}
                loading={loadingAll}
                error={errorAll}
                currentUserId={user?.id}
              />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading standings">
            <CollapsibleSection title="Player Standings" storageKey="section-standings" defaultOpen>
              <PlayerStandings
                matchesToday={matchesToday}
                allMatches={allMatches}
                players={players}
                teams={teams}
                loadingToday={loadingToday}
                loadingAll={loadingAll}
                errorToday={errorToday}
                errorAll={errorAll}
                currentUserId={user?.id}
              />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading top teams per player">
            <CollapsibleSection title="Top 3 Teams per Player" storageKey="section-playerTopTeams" defaultOpen={false}>
              <PlayerTopTeams players={players} allMatches={allMatches} teams={teams} loading={loadingAll} error={errorAll} />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading win percentage teams">
            <CollapsibleSection title="Top Win % Teams" storageKey="section-topWin" defaultOpen={false}>
              <TeamLeaderboard mode="win" teams={teams} allMatches={allMatches} players={players} loading={loadingAll} error={errorAll} currentUserId={user?.id} />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading loss percentage teams">
            <CollapsibleSection title="Top Loss % Teams" storageKey="section-topLoss" defaultOpen={false}>
              <TeamLeaderboard mode="loss" teams={teams} allMatches={allMatches} players={players} loading={loadingAll} error={errorAll} currentUserId={user?.id} />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading head-to-head stats">
            <CollapsibleSection title="Head-to-Head" storageKey="section-winMatrix" defaultOpen={false}>
              <PlayerWinMatrix players={players} allMatches={allMatches} teams={teams} loading={loadingAll} error={errorAll} />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading achievements">
            <CollapsibleSection title="Player Achievements" storageKey="section-achievements" defaultOpen={false}>
              <PlayerAchievements allMatches={allMatches} players={players} teams={teams} loading={loadingAll} error={errorAll} />
            </CollapsibleSection>
          </ErrorBoundary>
        </>
      )}

      <EditTeamModal
        isOpen={editingSlot !== null}
        onClose={() => setEditingSlot(null)}
        availableTeams={availableTeamsForEdit}
        currentTeam={editingSlot !== null && match ? match[editingSlot] : undefined}
        onTeamSelected={(team) => {
          if (editingSlot !== null) handleUpdateTeam(team, editingSlot);
        }}
      />
    </div>
  );
}
