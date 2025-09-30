import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TeamCard from '../components/TeamCard';
import EditTeamModal from '../components/EditTeamModal';
import SettingsModal from '../components/SettingsModal';
import AddMatchModal from '../components/AddMatchModal';
import MatchHistory from '../components/MatchHistory';
import PlayerStandings from '../components/PlayerStandings';
import TopWinPercentageTeams from '../components/TopWinPercentageTeams';
import TopLossPercentageTeams from '../components/TopLossPercentageTeams';
import { Team, Player, Match, MatchPlayer, MatchHistoryItem, PlayerStanding, TeamStanding } from '../types';
import { supabase } from '../lib/supabaseClient';
import { Dices, Settings, PlusSquare } from 'lucide-react';

interface HomeProps {
  allTeams: Team[];
  allPlayers: Player[];
  loading: boolean;
  error: string | null;
  minRating: number;
  maxRating: number;
  excludeNations: boolean;
  matchesToday: MatchHistoryItem[];
  allMatches: MatchHistoryItem[];
  loadingHistory: boolean;
  loadingAllMatches: boolean;
  historyError: string | null;
  allMatchesError: string | null;
  playerStandings: PlayerStanding[];
  overallPlayerStandings: PlayerStanding[];
  teamStatistics: TeamStanding[];
  onRefreshHistory: () => void;
  onSaveSettings: (newMinRating: number, newMaxRating: number, newExcludeNations: boolean) => void;
  onUpdatePlayerName: (playerId: string, newName: string) => void;
  onMatchSaved: () => void;
}

// Function to get a random team from a filtered list
const getRandomTeam = (teams: Team[], excludeId?: string): Team | null => {
  if (teams.length === 0) return null;
  if (teams.length === 1 && teams[0].id === excludeId) return null;

  let availableTeams = teams;
  if (excludeId) {
    availableTeams = teams.filter(team => team.id !== excludeId);
    if (availableTeams.length === 0) return null;
  }

  const randomIndex = Math.floor(Math.random() * availableTeams.length);
  return availableTeams[randomIndex];
};

// Function to get an initial match from a filtered list
const getInitialMatch = (teams: Team[]): [Team, Team] | null => {
  if (teams.length < 2) return null;
  const team1 = getRandomTeam(teams);
  if (!team1) return null;
  const team2 = getRandomTeam(teams, team1.id);
  if (!team2) return null;
  return [team1, team2];
};

const Home: React.FC<HomeProps> = ({
  allTeams,
  allPlayers,
  loading,
  error,
  minRating,
  maxRating,
  excludeNations,
  matchesToday,
  allMatches,
  loadingHistory,
  loadingAllMatches,
  historyError,
  allMatchesError,
  playerStandings,
  overallPlayerStandings,
  teamStatistics,
  onRefreshHistory,
  onSaveSettings,
  onUpdatePlayerName,
  onMatchSaved,
}) => {
  const [match, setMatch] = useState<[Team, Team] | null>(null);
  
  // Settings Modal State
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<0 | 1 | null>(null);

  // Add Match Modal State
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState<boolean>(false);

  // Filtered teams based on rating and nation settings
  const filteredTeams = useMemo(() => {
    return allTeams.filter(team => {
        const ratingMatch = team.rating >= minRating && team.rating <= maxRating;
        const nationMatch = !excludeNations || team.league !== 'Nation';
        return ratingMatch && nationMatch;
    });
  }, [allTeams, minRating, maxRating, excludeNations]);

  // Generate initial match when filteredTeams changes
  useEffect(() => {
    if (filteredTeams.length >= 2) {
      const initialMatch = getInitialMatch(filteredTeams);
      setMatch(initialMatch);
    } else {
      setMatch(null);
    }
  }, [filteredTeams]);

  // --- Handler Functions ---
  const handleGenerateNewMatch = () => {
    const playedTeamIdsToday = new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id]));
    const availableTeams = filteredTeams.filter(team => !playedTeamIdsToday.has(team.id));
    const newMatch = getInitialMatch(availableTeams);
    setMatch(newMatch);
  };

  const handleOpenEditModal = (teamIndex: 0 | 1) => {
    setEditingTeamIndex(teamIndex);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingTeamIndex(null);
  };

  const handleUpdateTeam = (newTeam: Team) => {
    if (match && editingTeamIndex !== null) {
      const updatedMatch: [Team, Team] = [...match] as [Team, Team];
      updatedMatch[editingTeamIndex] = newTeam;
      setMatch(updatedMatch);
    }
    handleCloseEditModal();
  };

  const handleOpenSettingsModal = () => {
    setIsSettingsModalOpen(true);
  };

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  const handleOpenAddMatchModal = () => {
    setIsAddMatchModalOpen(true);
  };

  const handleCloseAddMatchModal = () => {
    setIsAddMatchModalOpen(false);
  };

  const handleMatchSaved = () => {
    onMatchSaved();
    handleCloseAddMatchModal();
  };

  // Calculate differences
  const differences = match ? {
    overall: match[0].overallRating - match[1].overallRating,
    attack: match[0].attackRating - match[1].attackRating,
    midfield: match[0].midfieldRating - match[1].midfieldRating,
    defend: match[0].defendRating - match[1].defendRating,
  } : null;
  const team1Differences = differences ? { overall: differences.overall, attack: differences.attack, midfield: differences.midfield, defend: differences.defend } : undefined;
  const team2Differences = differences ? { overall: -differences.overall, attack: -differences.attack, midfield: -differences.midfield, defend: -differences.defend } : undefined;

  // Determine if New Matchup button should be disabled
  const playedTeamIdsToday = useMemo(() => new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id])), [matchesToday]);
  const availableForNewMatchupCount = useMemo(() => filteredTeams.filter(team => !playedTeamIdsToday.has(team.id)).length, [filteredTeams, playedTeamIdsToday]);
  const canGenerateNewMatch = availableForNewMatchupCount >= 2;

  return (
    <main className="grow bg-linear-to-br from-brand-lighter via-brand-light to-brand-medium p-4 flex flex-col items-center">
      {loading && <p className="text-gray-600 mt-8">Loading initial data...</p>}
      {error && <p className="text-red-600 bg-red-100 p-3 rounded-sm text-center mb-4 max-w-xl mx-auto mt-8">{error}</p>}

      {/* Match Display */}
      {!loading && !error && match && (
        <div className="w-full max-w-4xl mb-6 mt-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            <TeamCard team={match[0]} differences={team1Differences} onEdit={() => handleOpenEditModal(0)} />
            <div className="text-2xl font-bold text-gray-700 my-2 md:my-0">VS</div>
            <TeamCard team={match[1]} differences={team2Differences} onEdit={() => handleOpenEditModal(1)} />
          </div>
        </div>
      )}
       {!loading && !error && !match && filteredTeams.length >= 2 && !canGenerateNewMatch && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded-sm mb-6 text-center max-w-md mt-8">
            No valid matchup displayed. All teams within the current filter have played today.
         </p>
       )}

       {/* Buttons Container */}
       {!loading && !error && allTeams.length > 0 && (
         <div className="flex items-center justify-center mb-6">
           {/* Button Group Container - Removed gradient, added shadow */}
           <div className="inline-flex rounded-lg shadow-md overflow-hidden">
             <button
               onClick={handleGenerateNewMatch}
               className="flex items-center justify-center px-5 py-2.5 bg-brand-dark text-white font-semibold hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed border-r border-white/20"
               disabled={!canGenerateNewMatch}
               title={canGenerateNewMatch ? "Generate New Random Matchup (excluding teams played today)" : "Not enough unplayed teams available in filter"}
             >
               <Dices className="w-5 h-5 mr-2" /> New Matchup
             </button>
             <button
               onClick={handleOpenAddMatchModal}
               className="flex items-center justify-center px-5 py-2.5 bg-brand-dark text-white font-semibold hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed border-r border-white/20"
               disabled={!match}
               title="Add Current Matchup to History"
             >
               <PlusSquare className="w-5 h-5 mr-2" /> Add Match
             </button>
             <button
               onClick={handleOpenSettingsModal}
               className="p-2.5 bg-brand-dark text-white hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out"
               aria-label="Open settings"
               title="Settings"
             >
               <Settings className="w-5 h-5" />
             </button>
           </div>
         </div>
       )}

      {/* Informative messages */}
       {!loading && !error && allTeams.length > 0 && filteredTeams.length < 2 && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded-sm mb-6 text-center max-w-md">
           Only {filteredTeams.length} team(s) match the current rating filter ({minRating.toFixed(1)} - {maxRating.toFixed(1)} stars{excludeNations ? ', excluding nations' : ''}). Need at least 2 to generate a match. Adjust settings.
         </p>
       )}
        {!loading && !error && allTeams.length > 0 && filteredTeams.length >= 2 && !canGenerateNewMatch && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded-sm mb-6 text-center max-w-md">
           All {filteredTeams.length} team(s) matching the filter{excludeNations ? ' (excluding nations)' : ''} have already played today. Cannot generate a new matchup.
         </p>
       )}
       {!loading && !error && allTeams.length === 0 && (
         <p className="text-gray-600 mb-6 text-center mt-8">No teams available to display.</p> 
       )}

       {/* Match History */}
       {!loading && !error && (
           <MatchHistory matchesToday={matchesToday} loading={loadingHistory} error={historyError} onRefresh={onRefreshHistory} allPlayers={allPlayers} />
       )}

       {/* Player Standings */}
       {!loading && !error && (
            <PlayerStandings standings={playerStandings} loading={loadingHistory} error={historyError} title="Player Standings (Today)" matches={matchesToday} />
       )}

       {/* Overall Player Standings */}
       {!loading && !error && (
            <PlayerStandings standings={overallPlayerStandings} loading={loadingAllMatches} error={allMatchesError} title="Player Standings (Overall)" matches={allMatches} />
       )}

       {/* Top Win Percentage Teams */}
       {!loading && !error && (
            <TopWinPercentageTeams teamStandings={teamStatistics} loading={loadingAllMatches} error={allMatchesError} allMatches={allMatches} />
       )}

       {/* Top Loss Percentage Teams */}
       {!loading && !error && (
            <TopLossPercentageTeams teamStandings={teamStatistics} loading={loadingAllMatches} error={allMatchesError} allMatches={allMatches} />
       )}

      {/* Modals */}
      <EditTeamModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} allTeams={filteredTeams.filter(team => !playedTeamIdsToday.has(team.id))} onTeamSelected={handleUpdateTeam} currentTeam={editingTeamIndex !== null && match ? match[editingTeamIndex] : undefined} />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
        onSave={onSaveSettings}
        initialMinRating={minRating}
        initialMaxRating={maxRating}
        initialExcludeNations={excludeNations}
        allPlayers={allPlayers}
        onUpdatePlayerName={onUpdatePlayerName}
      />
       <AddMatchModal isOpen={isAddMatchModalOpen} onClose={handleCloseAddMatchModal} matchTeams={match} onMatchSaved={handleMatchSaved} />
    </main>
  );
};

export default Home;