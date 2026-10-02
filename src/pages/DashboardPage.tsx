import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
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

export default function DashboardPage() {
  const {
    teams, players, teamsLoading, playersLoading, teamsError, playersError,
    matchesToday, allMatches, loadingToday, loadingAll, errorToday, errorAll,
    match, matchError, isAnimating, pendingMatch, availableTeamsForEdit,
    handleAnimationComplete, handleUpdateTeam,
  } = useAppLayoutContext();
  const { user, isAdmin } = useAuth();

  const [editingSlot, setEditingSlot] = useState<0 | 1 | null>(null);

  const initialLoading = teamsLoading || playersLoading;
  const initialError = teamsError || playersError;

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
          {isAnimating && pendingMatch ? (
            <MatchRevealAnimation teams={pendingMatch} allTeams={teams} onAnimationComplete={handleAnimationComplete} />
          ) : match ? (
            <>
              <TeamCard team={match[0]} onEdit={isAdmin ? () => setEditingSlot(0) : undefined} />
              <div className="flex items-center gap-2.5">
                <div className="h-0.5 flex-1 bg-(--color-ink)" />
                <div className="flex h-9 w-9 flex-none items-center justify-center border-2 border-(--color-ink) bg-(--color-green-bright) text-xs font-black text-(--color-ink)">
                  VS
                </div>
                <div className="h-0.5 flex-1 bg-(--color-ink)" />
              </div>
              <TeamCard team={match[1]} onEdit={isAdmin ? () => setEditingSlot(1) : undefined} />
              <MatchComparison team1={match[0]} team2={match[1]} />
            </>
          ) : (
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
            <CollapsibleSection title="Game Sessions" storageKey="section-gameSessions">
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
            <CollapsibleSection title="Top 3 Teams per Player" storageKey="section-playerTopTeams">
              <PlayerTopTeams players={players} allMatches={allMatches} teams={teams} loading={loadingAll} error={errorAll} />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading win percentage teams">
            <CollapsibleSection title="Top Win % Teams" storageKey="section-topWin">
              <TeamLeaderboard mode="win" teams={teams} allMatches={allMatches} players={players} loading={loadingAll} error={errorAll} currentUserId={user?.id} />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading loss percentage teams">
            <CollapsibleSection title="Top Loss % Teams" storageKey="section-topLoss">
              <TeamLeaderboard mode="loss" teams={teams} allMatches={allMatches} players={players} loading={loadingAll} error={errorAll} currentUserId={user?.id} />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading head-to-head stats">
            <CollapsibleSection title="Head-to-Head" storageKey="section-winMatrix">
              <PlayerWinMatrix players={players} allMatches={allMatches} loading={loadingAll} error={errorAll} />
            </CollapsibleSection>
          </ErrorBoundary>

          <ErrorBoundary fallbackTitle="Error loading achievements">
            <CollapsibleSection title="Player Achievements" storageKey="section-achievements">
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
