import React, { useMemo, useState } from 'react';
import { Outlet, useOutletContext } from 'react-router-dom';
import Header from './Header';
import AuthWrapper from './AuthWrapper';
import BottomNav from './BottomNav';
import SettingsModal from './SettingsModal';
import AddMatchModal from './AddMatchModal';
import { useMatchesRealtimeSync } from '../hooks/useMatchesRealtimeSync';
import { useSettings } from '../hooks/useSettings';
import { UpdateTeamOptions, useMatchGenerator } from '../hooks/useMatchGenerator';
import { useTeamsQuery } from '../queries/teams';
import { usePlayersQuery } from '../queries/players';
import { useAllMatchesQuery, useMatchesTodayQuery } from '../queries/matches';
import { useAuth } from '../contexts/AuthContext';
import { MatchHistoryItem, Player, Team } from '../types';

export interface AppLayoutContextValue {
  teams: Team[];
  players: Player[];
  teamsLoading: boolean;
  playersLoading: boolean;
  teamsError: string | null;
  playersError: string | null;

  matchesToday: MatchHistoryItem[];
  allMatches: MatchHistoryItem[];
  loadingToday: boolean;
  loadingAll: boolean;
  errorToday: string | null;
  errorAll: string | null;

  match: [Team, Team] | null;
  matchError: string | null;
  canGenerateNewMatch: boolean;
  /** Set while MatchRevealAnimation is playing out a freshly-generated matchup. */
  isAnimating: boolean;
  /** The matchup being revealed — becomes `match` once the animation calls handleAnimationComplete. */
  pendingMatch: [Team, Team] | null;
  /** Teams passing the current rating/version/nation filters, minus teams already played today — what EditTeamModal should offer. */
  availableTeamsForEdit: Team[];
  /** Teams passing the current rating/version/nation filters (played today or not) — the reveal animation's spin pool. */
  filteredTeams: Team[];
  /** Current matchup filter settings — for the dashboard's "filter can't produce a matchup" banners. */
  filterSettings: { minRating: number; maxRating: number; excludeNations: boolean; selectedVersion: string };
  openSettings: () => void;
  handleGenerateNewMatch: (excludeTeamIds?: string[]) => void;
  handleAnimationComplete: () => void;
  handleUpdateTeam: (team: Team, slot: 0 | 1, options?: UpdateTeamOptions) => void;
  /** Max OVR difference allowed between the two sides (settings) — the joker draw respects it. */
  maxOvrDiff: number;
  /** Signed-in users with a profile — RLS only lets them write matches, picks and jokers. */
  canWrite: boolean;
}

export function useAppLayoutContext() {
  return useOutletContext<AppLayoutContextValue>();
}

const errorMessage = (error: unknown): string | null => (error instanceof Error ? error.message : null);

// Owns the shell (Header, auth gate, BottomNav, the Settings/Add Match
// sheets) plus the shared dashboard data (teams/players/matches queries,
// filters, the matchup generator) every routed page needs — exposed to
// pages via useAppLayoutContext().
const AppLayout: React.FC = () => {
  useMatchesRealtimeSync();
  const { user, isAdmin, isNormalUser } = useAuth();

  const teamsQuery = useTeamsQuery();
  const playersQuery = usePlayersQuery();
  const matchesTodayQuery = useMatchesTodayQuery();
  const allMatchesQuery = useAllMatchesQuery();

  const settings = useSettings();
  const {
    minRating, maxRating, excludeNations, selectedVersion, maxOvrDiff,
    isSettingsModalOpen, handleOpenSettingsModal, handleCloseSettingsModal, handleSaveSettings,
  } = settings;

  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState(false);

  // Memoized so `?? []` doesn't hand out a fresh array reference every
  // render — filteredTeams/useMatchGenerator below depend on these
  // referentially, and an unstable reference would recompute/regenerate
  // the matchup on every unrelated re-render.
  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);
  const players = useMemo(() => playersQuery.data ?? [], [playersQuery.data]);
  const matchesToday = useMemo(() => matchesTodayQuery.data ?? [], [matchesTodayQuery.data]);
  const allMatches = useMemo(() => allMatchesQuery.data ?? [], [allMatchesQuery.data]);

  const filteredTeams = useMemo(() => teams.filter(team => {
    const ratingMatch = team.rating >= minRating && team.rating <= maxRating;
    const nationMatch = !excludeNations || team.league !== 'Nation';
    const versionMatch = team.version === selectedVersion;
    return ratingMatch && nationMatch && versionMatch;
  }), [teams, minRating, maxRating, excludeNations, selectedVersion]);

  const ready = teamsQuery.isSuccess && playersQuery.isSuccess && matchesTodayQuery.isSuccess;

  const {
    match, pendingMatch, isAnimating, error: matchError, canGenerateNewMatch, playedTeamIdsToday,
    handleGenerateNewMatch, handleAnimationComplete, handleUpdateTeam,
  } = useMatchGenerator({
    filteredTeams,
    matchesToday,
    allMatches,
    maxOvrDiff,
    excludeNations,
    minRating,
    maxRating,
    ready,
  });

  const availableTeamsForEdit = useMemo(
    () => filteredTeams.filter(t => !playedTeamIdsToday.has(t.id)),
    [filteredTeams, playedTeamIdsToday]
  );

  const handleMatchSaved = (action: 'rematch' | 'next') => {
    if (action === 'next' && match) handleGenerateNewMatch([match[0].id, match[1].id]);
  };

  const contextValue: AppLayoutContextValue = {
    teams,
    players,
    teamsLoading: teamsQuery.isLoading,
    playersLoading: playersQuery.isLoading,
    teamsError: errorMessage(teamsQuery.error),
    playersError: errorMessage(playersQuery.error),

    matchesToday,
    allMatches,
    loadingToday: matchesTodayQuery.isLoading,
    loadingAll: allMatchesQuery.isLoading,
    errorToday: errorMessage(matchesTodayQuery.error),
    errorAll: errorMessage(allMatchesQuery.error),

    match,
    matchError,
    canGenerateNewMatch,
    isAnimating,
    pendingMatch,
    availableTeamsForEdit,
    filteredTeams,
    filterSettings: { minRating, maxRating, excludeNations, selectedVersion },
    openSettings: handleOpenSettingsModal,
    handleGenerateNewMatch,
    handleAnimationComplete,
    handleUpdateTeam,
    maxOvrDiff,
    canWrite: isAdmin || isNormalUser,
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Header />
      <AuthWrapper>
        <div className="flex min-h-0 flex-1 flex-col">
          <main className="flex-1 overflow-y-auto bg-[#fafafa]">
            <Outlet context={contextValue} />
          </main>
          <BottomNav
            onNewMatchup={() => handleGenerateNewMatch()}
            onAddMatch={() => setIsAddMatchModalOpen(true)}
            onSettings={handleOpenSettingsModal}
            canGenerateNewMatch={canGenerateNewMatch && !isAnimating}
            hasMatch={!!match}
            canAddMatch={isAdmin || isNormalUser}
          />
        </div>
      </AuthWrapper>

      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
        onSave={handleSaveSettings}
        initialMinRating={minRating}
        initialMaxRating={maxRating}
        initialExcludeNations={excludeNations}
        initialSelectedVersion={selectedVersion}
        initialMaxOvrDiff={maxOvrDiff}
        teams={teams}
        players={players}
      />
      <AddMatchModal
        isOpen={isAddMatchModalOpen}
        onClose={() => setIsAddMatchModalOpen(false)}
        matchTeams={match}
        players={players}
        currentUserId={user?.id}
        onSaved={handleMatchSaved}
      />
    </div>
  );
};

export default AppLayout;
