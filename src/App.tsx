import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TeamCard from './components/TeamCard';
import EditTeamModal from './components/EditTeamModal';
import SettingsModal from './components/SettingsModal';
import AddMatchModal from './components/AddMatchModal';
import MatchHistory from './components/MatchHistory';
import PlayerStandings from './components/PlayerStandings';
import { Team, Player, Match, MatchPlayer, MatchHistoryItem, PlayerStanding } from './types';
import { supabase } from './lib/supabaseClient';
import { Dices, Settings, PlusSquare } from 'lucide-react';

// --- Constants for Session Storage ---
const MIN_RATING_STORAGE_KEY = 'fcGeneratorMinRating';
const MAX_RATING_STORAGE_KEY = 'fcGeneratorMaxRating';

// --- Helper Functions for Session Storage ---
const getInitialRating = (key: string, defaultValue: number): number => {
  try {
    const storedValue = sessionStorage.getItem(key);
    if (storedValue !== null) {
      const parsedValue = parseFloat(storedValue);
      if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= 5) {
        return parsedValue;
      }
    }
  } catch (error) {
    console.error(`Error reading ${key} from sessionStorage:`, error);
  }
  return defaultValue;
};

// Fetch all teams from Supabase
const fetchAllTeams = async (): Promise<Team[]> => {
  console.log("Fetching all teams...");
  const { data, error } = await supabase.from('teams').select('*');
  if (error) {
    console.error("Error fetching teams:", error);
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }
  return data || [];
};

// Fetch all players from Supabase
const fetchAllPlayers = async (): Promise<Player[]> => {
    console.log("Fetching all players...");
    const { data, error } = await supabase.from('players').select('*').order('name');
    if (error) {
        console.error("Error fetching players:", error);
        throw new Error(`Failed to fetch players: ${error.message}`);
    }
    return data || [];
};

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


function App() {
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [match, setMatch] = useState<[Team, Team] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Settings State - Updated default minRating to 4
  const [minRating, setMinRating] = useState<number>(() => getInitialRating(MIN_RATING_STORAGE_KEY, 4));
  const [maxRating, setMaxRating] = useState<number>(() => getInitialRating(MAX_RATING_STORAGE_KEY, 5));
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<0 | 1 | null>(null);

  // Add Match Modal State
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState<boolean>(false);

  // Match History State
  const [matchesToday, setMatchesToday] = useState<MatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState<number>(0);


  // Filtered teams based on rating settings
  const filteredTeams = useMemo(() => {
    return allTeams.filter(team => team.rating >= minRating && team.rating <= maxRating);
  }, [allTeams, minRating, maxRating]);

  // Fetch Today's Match History
  const fetchTodaysMatches = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    console.log("[App] Fetching today's matches...");

    try {
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setUTCDate(todayStart.getUTCDate() + 1);

      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .gte('played_at', todayStart.toISOString())
        .lt('played_at', todayEnd.toISOString())
        .order('played_at', { ascending: false });

      if (matchesError) throw matchesError;
      if (!matchesData) {
          setMatchesToday([]);
          setLoadingHistory(false);
          return;
      }

      const matchIds = matchesData.map(m => m.id);
      let matchPlayersData: MatchPlayer[] = [];
      if (matchIds.length > 0) {
          const { data: mpData, error: mpError } = await supabase
              .from('match_players')
              .select('*')
              .in('match_id', matchIds);
          if (mpError) throw mpError;
          matchPlayersData = mpData || [];
      }

      // Use the current allPlayers state which might have pending updates
      // It's generally better to fetch fresh data if consistency is critical,
      // but for this case, using the state is simpler for immediate feedback.
      const playerMap = new Map(allPlayers.map(p => [p.id, p]));
      const teamMap = new Map(allTeams.map(t => [t.id, t]));


      const combinedMatches: MatchHistoryItem[] = matchesData.map(match => {
        const team1 = teamMap.get(match.team1_id);
        const team2 = teamMap.get(match.team2_id);
        const playersInMatch = matchPlayersData.filter(mp => mp.match_id === match.id);

        return {
          ...match,
          team1_name: team1?.name ?? 'Unknown Team',
          team1_logoUrl: team1?.logoUrl ?? '',
          team2_name: team2?.name ?? 'Unknown Team',
          team2_logoUrl: team2?.logoUrl ?? '',
          team1_players: playersInMatch
            .filter(mp => mp.team_number === 1)
            .map(mp => playerMap.get(mp.player_id)) // Use playerMap based on current state
            .filter((p): p is Player => p !== undefined),
          team2_players: playersInMatch
            .filter(mp => mp.team_number === 2)
            .map(mp => playerMap.get(mp.player_id)) // Use playerMap based on current state
            .filter((p): p is Player => p !== undefined),
        };
      });

      console.log("[App] Today's matches fetched:", combinedMatches);
      setMatchesToday(combinedMatches);

    } catch (err: any) {
      console.error('[App] Error fetching match history:', err);
      setHistoryError('Failed to load match history.');
      setMatchesToday([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [allTeams, allPlayers]); // Depend on allPlayers state now

  // Fetch initial data (teams, players)
  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([fetchAllTeams(), fetchAllPlayers()])
      .then(([teamsData, playersData]) => {
        if (teamsData.length === 0) {
          console.warn("No teams found in the database.");
          setError("No teams found. Please ensure the 'teams' table exists and contains data.");
          setAllTeams([]);
        } else {
          setAllTeams(teamsData);
        }
        setAllPlayers(playersData);
      })
      .catch(err => {
        console.error("Failed to fetch initial data:", err);
        setError(err.message || "Failed to load initial data.");
        setAllTeams([]);
        setAllPlayers([]);
        setMatch(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // Fetch history once teams/players are loaded, and when triggered
  useEffect(() => {
    if (allTeams.length > 0 && allPlayers.length > 0) {
        fetchTodaysMatches();
    }
  }, [allTeams, allPlayers, refreshHistoryTrigger, fetchTodaysMatches]);


  // Effect to set initial match or update when filters/teams change
  useEffect(() => {
    if (!loading && allTeams.length > 0) {
        const currentMatchIsValid = match &&
                                    filteredTeams.some(t => t.id === match[0].id) &&
                                    filteredTeams.some(t => t.id === match[1].id);

        if (!currentMatchIsValid) {
             const playedTeamIds = new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id]));
             const availableForInitialMatch = filteredTeams.filter(t => !playedTeamIds.has(t.id));
             setMatch(getInitialMatch(availableForInitialMatch));
        } else if (filteredTeams.length < 2) {
             setMatch(null);
        }
    } else if (!loading && allTeams.length === 0) {
        setMatch(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTeams, loading, allTeams, matchesToday]);


  const handleGenerateNewMatch = () => {
    const playedTeamIds = new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id]));
    const availableTeamsForNewMatchup = filteredTeams.filter(team => !playedTeamIds.has(team.id));

    if (availableTeamsForNewMatchup.length >= 2) {
      const newMatch = getInitialMatch(availableTeamsForNewMatchup);
      setMatch(newMatch);
      setError(null);
    } else {
      setMatch(null);
      setError(`Not enough teams available for a new matchup within the current filter (${minRating.toFixed(1)}-${maxRating.toFixed(1)} stars) that haven't played today. Only ${availableTeamsForNewMatchup.length} team(s) remaining.`);
    }
  };

  // --- Edit Modal Handlers ---
  const handleOpenEditModal = (index: 0 | 1) => {
    setEditingTeamIndex(index);
    setIsEditModalOpen(true);
  };
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingTeamIndex(null);
  };
  const handleUpdateTeam = useCallback((newTeam: Team) => {
    if (editingTeamIndex === null || !match) return;

    const playedTeamIds = new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id]));
    const potentialOpponentPool = filteredTeams.filter(t => !playedTeamIds.has(t.id) && t.id !== newTeam.id);

    const otherTeamIndex = editingTeamIndex === 0 ? 1 : 0;
    let newOpponent = match[otherTeamIndex];

    if (newOpponent.id === newTeam.id || playedTeamIds.has(newOpponent.id)) {
      const potentialOpponent = getRandomTeam(potentialOpponentPool);
      if (potentialOpponent) {
        newOpponent = potentialOpponent;
      } else {
        console.warn("Could not find a different, unplayed opponent within the current filter.");
      }
    }

    const updatedMatch: [Team, Team] = [...match];
    updatedMatch[editingTeamIndex] = newTeam;
    updatedMatch[otherTeamIndex] = newOpponent;
    setMatch(updatedMatch);
    handleCloseEditModal();
  }, [match, editingTeamIndex, filteredTeams, matchesToday]);

  // --- Settings Modal Handlers ---
  const handleOpenSettingsModal = () => setIsSettingsModalOpen(true);
  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false);
  const handleSaveSettings = (newMinRating: number, newMaxRating: number) => {
    setMinRating(newMinRating);
    setMaxRating(newMaxRating);
    try {
      sessionStorage.setItem(MIN_RATING_STORAGE_KEY, newMinRating.toString());
      sessionStorage.setItem(MAX_RATING_STORAGE_KEY, newMaxRating.toString());
    } catch (error) {
      console.error("Error saving settings to sessionStorage:", error);
    }
    setError(null);
    // Note: Modal closing is now handled within SettingsModal component itself
  };

  // --- Player Name Update Handler ---
  const handleUpdatePlayerName = async (playerId: string, newName: string): Promise<boolean> => {
    console.log(`[App] Attempting to update player ${playerId} to name: ${newName}`);
    try {
      // Step 1: Update the database
      const { error } = await supabase
        .from('players')
        .update({ name: newName })
        .eq('id', playerId)
        .select() // Optionally select to confirm update, though not strictly needed here
        .single(); // Use single if you expect exactly one row updated

      if (error) {
        console.error(`[App] Error updating player ${playerId} in DB:`, error);
        throw error; // Re-throw to be caught below
      }

      console.log(`[App] Player ${playerId} updated successfully in DB.`);

      // Step 2: Update local state ONLY if DB update was successful
      setAllPlayers(prevPlayers =>
        prevPlayers.map(p => (p.id === playerId ? { ...p, name: newName } : p))
      );
      console.log(`[App] Player ${playerId} updated successfully locally.`);

      // Step 3: Trigger refresh for components depending on player data (History, Standings)
      // setRefreshHistoryTrigger(prev => prev + 1); // Already done in SettingsModal, but keep here for clarity if needed elsewhere

      return true; // Indicate success

    } catch (err) {
      // Error already logged above
      // Optionally: Show a user-facing error message here or in the modal
      return false; // Indicate failure
    }
  };


  // --- Add Match Modal Handlers ---
  const handleOpenAddMatchModal = () => setIsAddMatchModalOpen(true);
  const handleCloseAddMatchModal = () => setIsAddMatchModalOpen(false);
  const handleMatchSaved = () => {
    setRefreshHistoryTrigger(prev => prev + 1);
  };

  // --- Manual Refresh Handler ---
  const handleManualRefreshHistory = () => {
      setRefreshHistoryTrigger(prev => prev + 1);
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

  // Calculate Player Standings
  const playerStandings = useMemo(() => {
    console.log("[App] Calculating player standings...");
    const standingsMap = new Map<string, PlayerStanding>();
    const teamMap = new Map(allTeams.map(t => [t.id, t])); // Map teams for quick lookup

    allPlayers.forEach(player => {
      standingsMap.set(player.id, {
        playerId: player.id,
        playerName: player.name, // Use updated name from allPlayers state
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        totalOverallRating: 0, // Initialize new field
      });
    });

    matchesToday.forEach(match => {
      const team1 = teamMap.get(match.team1_id);
      const team2 = teamMap.get(match.team2_id);

      // Only process matches with scores for points and goals
      const hasScores = match.team1_score !== null && match.team2_score !== null;
      let winnerTeamNumber: 1 | 2 | null = null;
      if (hasScores) {
        const score1 = match.team1_score!;
        const score2 = match.team2_score!;
        if (score1 > score2) winnerTeamNumber = 1;
        else if (score2 > score1) winnerTeamNumber = 2;
      }

      // Process Team 1 Players
      match.team1_players.forEach(player => {
        const standing = standingsMap.get(player.id);
        if (standing) {
          if (hasScores) {
            standing.goalsFor += match.team1_score!;
            standing.goalsAgainst += match.team2_score!;
            if (winnerTeamNumber === 1) {
              standing.points += 1;
            }
          }
          // Add team overall rating regardless of score
          if (team1) {
            standing.totalOverallRating += team1.overallRating;
          }
        }
      });

      // Process Team 2 Players
      match.team2_players.forEach(player => {
        const standing = standingsMap.get(player.id);
        if (standing) {
          if (hasScores) {
            standing.goalsFor += match.team2_score!;
            standing.goalsAgainst += match.team1_score!;
            if (winnerTeamNumber === 2) {
              standing.points += 1;
            }
          }
          // Add team overall rating regardless of score
          if (team2) {
            standing.totalOverallRating += team2.overallRating;
          }
        }
      });
    });

    // Calculate goal difference after processing all matches
    const standingsArray = Array.from(standingsMap.values()).map(s => ({
        ...s,
        goalDifference: s.goalsFor - s.goalsAgainst
    }));

    // Sort based on points, then goal difference, then goals for
    standingsArray.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    console.log("[App] Player standings calculated:", standingsArray);
    return standingsArray;

  }, [matchesToday, allPlayers, allTeams]); // Depend on allTeams now for overall rating


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4 flex flex-col items-center">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mt-8 mb-6 text-center">
        EA FC Random Match Generator
      </h1>

      {loading && <p className="text-gray-600">Loading initial data...</p>}
      {error && <p className="text-red-600 bg-red-100 p-3 rounded text-center mb-4 max-w-xl mx-auto">{error}</p>}

      {/* Match Display */}
      {!loading && !error && match && (
        <div className="w-full max-w-4xl mb-6">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            <TeamCard team={match[0]} differences={team1Differences} onEdit={() => handleOpenEditModal(0)} />
            <div className="text-2xl font-bold text-gray-700 my-2 md:my-0">VS</div>
            <TeamCard team={match[1]} differences={team2Differences} onEdit={() => handleOpenEditModal(1)} />
          </div>
        </div>
      )}
       {!loading && !error && !match && filteredTeams.length >= 2 && !canGenerateNewMatch && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded mb-6 text-center max-w-md">
            No valid matchup displayed. All teams within the current filter have played today.
         </p>
       )}

       {/* Buttons Container */}
       {!loading && !error && allTeams.length > 0 && (
         <div className="flex items-center justify-center space-x-4 mb-6">
           <button onClick={handleGenerateNewMatch} className="flex items-center justify-center px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed" disabled={!canGenerateNewMatch} title={canGenerateNewMatch ? "Generate New Random Matchup (excluding teams played today)" : "Not enough unplayed teams available in filter"}>
             <Dices className="w-5 h-5 mr-2" /> New Matchup
           </button>
           <button onClick={handleOpenAddMatchModal} className="flex items-center justify-center px-5 py-2.5 bg-green-600 text-white font-semibold rounded-lg shadow-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-50" disabled={!match} title="Add Current Matchup to History">
             <PlusSquare className="w-5 h-5 mr-2" /> Add Match
           </button>
           <button onClick={handleOpenSettingsModal} className="p-2.5 bg-gray-600 text-white rounded-lg shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition duration-150 ease-in-out" aria-label="Open settings" title="Settings">
             <Settings className="w-5 h-5" />
           </button>
         </div>
       )}

      {/* Informative messages */}
       {!loading && !error && allTeams.length > 0 && filteredTeams.length < 2 && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded mb-6 text-center max-w-md">
           Only {filteredTeams.length} team(s) match the current rating filter ({minRating.toFixed(1)} - {maxRating.toFixed(1)} stars). Need at least 2 to generate a match. Adjust settings.
         </p>
       )}
        {!loading && !error && allTeams.length > 0 && filteredTeams.length >= 2 && !canGenerateNewMatch && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded mb-6 text-center max-w-md">
           All {filteredTeams.length} team(s) matching the filter have already played today. Cannot generate a new matchup.
         </p>
       )}
       {!loading && !error && allTeams.length === 0 && (
         <p className="text-gray-600 mb-6 text-center">No teams available to display.</p>
       )}

       {/* Match History */}
       {!loading && !error && (
           <MatchHistory matchesToday={matchesToday} loading={loadingHistory} error={historyError} onRefresh={handleManualRefreshHistory} allPlayers={allPlayers} />
       )}

       {/* Player Standings */}
       {!loading && !error && (
            <PlayerStandings standings={playerStandings} loading={loadingHistory} error={historyError} />
       )}

      {/* Modals */}
      <EditTeamModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} allTeams={filteredTeams.filter(team => !playedTeamIdsToday.has(team.id))} onTeamSelected={handleUpdateTeam} currentTeam={editingTeamIndex !== null && match ? match[editingTeamIndex] : undefined} />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
        onSave={handleSaveSettings}
        initialMinRating={minRating}
        initialMaxRating={maxRating}
        allPlayers={allPlayers} // Pass players
        onUpdatePlayerName={handleUpdatePlayerName} // Pass handler
      />
       <AddMatchModal isOpen={isAddMatchModalOpen} onClose={handleCloseAddMatchModal} matchTeams={match} onMatchSaved={handleMatchSaved} />
    </div>
  );
}

export default App;
