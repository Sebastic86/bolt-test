import { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/Header'; // Import the new Header component
import AuthWrapper from './components/AuthWrapper';
import { AdminOnly } from './components/RoleBasedComponents';
import UserManagement from './components/UserManagement';
import TeamCard from './components/TeamCard';
import EditTeamModal from './components/EditTeamModal';
import SettingsModal from './components/SettingsModal';
import AddMatchModal from './components/AddMatchModal';
import MatchHistory from './components/MatchHistory';
import AllMatches from './components/AllMatches';
import PlayerStandings from './components/PlayerStandings';
import TopWinPercentageTeams from './components/TopWinPercentageTeams';
import TopLossPercentageTeams from './components/TopLossPercentageTeams';
import PlayerWinMatrix from './components/PlayerWinMatrix';
import PlayerTopTeams from './components/PlayerTopTeams';
import { Team, Player, MatchPlayer, MatchHistoryItem, PlayerStanding, TeamStanding } from './types';
import { supabase } from './lib/supabaseClient';
import { Dices, Settings, PlusSquare, List, ArrowLeft } from 'lucide-react';

// --- Constants for Session Storage ---
const MIN_RATING_STORAGE_KEY = 'fcGeneratorMinRating';
const MAX_RATING_STORAGE_KEY = 'fcGeneratorMaxRating';
const EXCLUDE_NATIONS_STORAGE_KEY = 'fcGeneratorExcludeNations'; // New key
const SELECTED_VERSION_STORAGE_KEY = 'fcGeneratorSelectedVersion'; // New key for version
const MAX_OVR_DIFF_STORAGE_KEY = 'fcGeneratorMaxOvrDiff'; // New key for max OVR difference

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

const getInitialBoolean = (key: string, defaultValue: boolean): boolean => {
  try {
    const storedValue = sessionStorage.getItem(key);
    if (storedValue !== null) {
      return storedValue === 'true'; // Check if the stored string is 'true'
    }
  } catch (error) {
    console.error(`Error reading ${key} from sessionStorage:`, error);
  }
  return defaultValue;
};

const getInitialString = (key: string, defaultValue: string): string => {
  try {
    const storedValue = sessionStorage.getItem(key);
    if (storedValue !== null) {
      return storedValue;
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
const getRandomTeam = (teams: Team[], excludeId?: string, referenceOvr?: number, maxOvrDiff?: number, referenceLeague?: string): Team | null => {
  if (teams.length === 0) return null;
  if (teams.length === 1 && teams[0].id === excludeId) return null;

  let availableTeams = teams;
  if (excludeId) {
    availableTeams = teams.filter(team => team.id !== excludeId);
    if (availableTeams.length === 0) return null;
  }

  // Filter by OVR difference if specified
  if (referenceOvr !== undefined && maxOvrDiff !== undefined) {
    availableTeams = availableTeams.filter(team => Math.abs(team.overallRating - referenceOvr) <= maxOvrDiff);
    if (availableTeams.length === 0) return null;
  }

  // Filter by league if reference team is a Nation
  if (referenceLeague === 'Nation') {
    availableTeams = availableTeams.filter(team => team.league === 'Nation');
    if (availableTeams.length === 0) return null;
  }

  const randomIndex = Math.floor(Math.random() * availableTeams.length);
  return availableTeams[randomIndex];
};

// Function to get an initial match from a filtered list
const getInitialMatch = (teams: Team[], maxOvrDiff?: number): [Team, Team] | null => {
  if (teams.length < 2) return null;
  const team1 = getRandomTeam(teams);
  if (!team1) return null;
  const team2 = getRandomTeam(teams, team1.id, team1.overallRating, maxOvrDiff, team1.league);
  if (!team2) return null;
  return [team1, team2];
};


function App() {
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [match, setMatch] = useState<[Team, Team] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Settings State
  const [minRating, setMinRating] = useState<number>(() => getInitialRating(MIN_RATING_STORAGE_KEY, 4));
  const [maxRating, setMaxRating] = useState<number>(() => getInitialRating(MAX_RATING_STORAGE_KEY, 5));
  const [excludeNations, setExcludeNations] = useState<boolean>(() => getInitialBoolean(EXCLUDE_NATIONS_STORAGE_KEY, false)); // New state
  const [selectedVersion, setSelectedVersion] = useState<string>(() => getInitialString(SELECTED_VERSION_STORAGE_KEY, 'FC26')); // New state for version
  const [maxOvrDiff, setMaxOvrDiff] = useState<number>(() => {
    try {
      const storedValue = sessionStorage.getItem(MAX_OVR_DIFF_STORAGE_KEY);
      if (storedValue !== null) {
        const parsedValue = parseInt(storedValue);
        if (!isNaN(parsedValue) && parsedValue >= 0) {
          return parsedValue;
        }
      }
    } catch (error) {
      console.error(`Error reading ${MAX_OVR_DIFF_STORAGE_KEY} from sessionStorage:`, error);
    }
    return 5;
  }); // New state for max OVR difference
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<0 | 1 | null>(null);

  // Add Match Modal State
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState<boolean>(false);

  // Page Navigation State
  const [currentPage, setCurrentPage] = useState<'main' | 'allMatches'>('main');

  // Match History State
  const [matchesToday, setMatchesToday] = useState<MatchHistoryItem[]>([]);
  const [allMatches, setAllMatches] = useState<MatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [loadingAllMatches, setLoadingAllMatches] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [allMatchesError, setAllMatchesError] = useState<string | null>(null);
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState<number>(0);


  // Filtered teams based on rating, nation, and version settings
  const filteredTeams = useMemo(() => {
    return allTeams.filter(team => {
        const ratingMatch = team.rating >= minRating && team.rating <= maxRating;
        const nationMatch = !excludeNations || team.league !== 'Nation';
        const versionMatch = team.version === selectedVersion;
        return ratingMatch && nationMatch && versionMatch;
    });
  }, [allTeams, minRating, maxRating, excludeNations, selectedVersion]); // Add selectedVersion dependency

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
          team1_version: team1?.version ?? '',
          team2_name: team2?.name ?? 'Unknown Team',
          team2_logoUrl: team2?.logoUrl ?? '',
          team2_version: team2?.version ?? '',
          team1_players: playersInMatch
            .filter(mp => mp.team_number === 1)
            .map(mp => playerMap.get(mp.player_id))
            .filter((p): p is Player => p !== undefined),
          team2_players: playersInMatch
            .filter(mp => mp.team_number === 2)
            .map(mp => playerMap.get(mp.player_id))
            .filter((p): p is Player => p !== undefined),
        };
      });

      console.log("[App] Today's matches fetched:", combinedMatches);
      setMatchesToday(combinedMatches);

    } catch (err) {
      console.error('[App] Error fetching match history:', err);
      setHistoryError('Failed to load match history.');
      setMatchesToday([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [allTeams, allPlayers]);

  // Fetch All Matches (for overall standings)
  const fetchAllMatches = useCallback(async () => {
    setLoadingAllMatches(true);
    setAllMatchesError(null);
    console.log("[App] Fetching all matches...");

    try {
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .order('played_at', { ascending: false });

      if (matchesError) throw matchesError;
      if (!matchesData) {
          setAllMatches([]);
          setLoadingAllMatches(false);
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
          team1_version: team1?.version ?? '',
          team2_name: team2?.name ?? 'Unknown Team',
          team2_logoUrl: team2?.logoUrl ?? '',
          team2_version: team2?.version ?? '',
          team1_players: playersInMatch
            .filter(mp => mp.team_number === 1)
            .map(mp => playerMap.get(mp.player_id))
            .filter((p): p is Player => p !== undefined),
          team2_players: playersInMatch
            .filter(mp => mp.team_number === 2)
            .map(mp => playerMap.get(mp.player_id))
            .filter((p): p is Player => p !== undefined),
        };
      });

      console.log("[App] All matches fetched:", combinedMatches);
      setAllMatches(combinedMatches);

    } catch (err) {
      console.error('[App] Error fetching all matches:', err);
      setAllMatchesError('Failed to load all match history.');
      setAllMatches([]);
    } finally {
      setLoadingAllMatches(false);
    }
  }, [allTeams, allPlayers]);

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
        fetchAllMatches();
    }
  }, [allTeams, allPlayers, refreshHistoryTrigger, fetchTodaysMatches, fetchAllMatches]);


  // Effect to set initial match or update when filters/teams change
  useEffect(() => {
    if (!loading && allTeams.length > 0) {
        const currentMatchIsValid = match &&
                                    filteredTeams.some(t => t.id === match[0].id) &&
                                    filteredTeams.some(t => t.id === match[1].id);

        if (!currentMatchIsValid) {
             const playedTeamIds = new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id]));
             const availableForInitialMatch = filteredTeams.filter(t => !playedTeamIds.has(t.id));
             setMatch(getInitialMatch(availableForInitialMatch, maxOvrDiff));
        } else if (filteredTeams.length < 2) {
             setMatch(null);
        }
    } else if (!loading && allTeams.length === 0) {
        setMatch(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTeams, loading, allTeams, matchesToday, maxOvrDiff]);


  const handleGenerateNewMatch = () => {
    const playedTeamIds = new Set(matchesToday.flatMap(m => [m.team1_id, m.team2_id]));
    const availableTeamsForNewMatchup = filteredTeams.filter(team => !playedTeamIds.has(team.id));

    if (availableTeamsForNewMatchup.length >= 2) {
      const newMatch = getInitialMatch(availableTeamsForNewMatchup, maxOvrDiff);
      if (newMatch) {
        setMatch(newMatch);
        setError(null);
      } else {
        setMatch(null);
        const nationFilterText = excludeNations ? " excluding nations" : "";
        setError(`Not enough teams available for a new matchup within the current filter (${minRating.toFixed(1)}-${maxRating.toFixed(1)} stars${nationFilterText}, max OVR diff ${maxOvrDiff}) that haven't played today. Only ${availableTeamsForNewMatchup.length} team(s) remaining.`);
      }
    } else {
      setMatch(null);
      const nationFilterText = excludeNations ? " excluding nations" : "";
      setError(`Not enough teams available for a new matchup within the current filter (${minRating.toFixed(1)}-${maxRating.toFixed(1)} stars${nationFilterText}) that haven't played today. Only ${availableTeamsForNewMatchup.length} team(s) remaining.`);
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
    // Ensure the potential opponent pool also respects the current filters (rating + nations)
    const potentialOpponentPool = filteredTeams.filter(t => !playedTeamIds.has(t.id) && t.id !== newTeam.id);

    const otherTeamIndex = editingTeamIndex === 0 ? 1 : 0;
    let newOpponent = match[otherTeamIndex];

    // Check if the current opponent is invalid (same as new team, already played, doesn't match filters, OVR diff too large, or league mismatch)
    const leagueMatch = newTeam.league === 'Nation' ? newOpponent.league === 'Nation' : true;
    const currentOpponentIsValid = filteredTeams.some(t => t.id === newOpponent.id) &&
                                    !playedTeamIds.has(newOpponent.id) &&
                                    Math.abs(newOpponent.overallRating - newTeam.overallRating) <= maxOvrDiff &&
                                    leagueMatch;

    if (newOpponent.id === newTeam.id || !currentOpponentIsValid) {
      const potentialOpponent = getRandomTeam(potentialOpponentPool, undefined, newTeam.overallRating, maxOvrDiff, newTeam.league);
      if (potentialOpponent) {
        newOpponent = potentialOpponent;
      } else {
        console.warn("Could not find a different, unplayed, filter-matching opponent with acceptable OVR difference and league constraint.");
        // Optionally, keep the old opponent if no better one is found, or handle error
      }
    }

    const updatedMatch: [Team, Team] = [...match];
    updatedMatch[editingTeamIndex] = newTeam;
    updatedMatch[otherTeamIndex] = newOpponent;
    setMatch(updatedMatch);
    handleCloseEditModal();
  }, [match, editingTeamIndex, filteredTeams, matchesToday, maxOvrDiff]);

  // --- Settings Modal Handlers ---
  const handleOpenSettingsModal = () => setIsSettingsModalOpen(true);
  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false);
  const handleSaveSettings = (newMinRating: number, newMaxRating: number, newExcludeNations: boolean, newSelectedVersion: string, newMaxOvrDiff: number) => {
    setMinRating(newMinRating);
    setMaxRating(newMaxRating);
    setExcludeNations(newExcludeNations); // Save new setting
    setSelectedVersion(newSelectedVersion); // Save new version setting
    setMaxOvrDiff(newMaxOvrDiff); // Save new max OVR diff setting
    try {
      sessionStorage.setItem(MIN_RATING_STORAGE_KEY, newMinRating.toString());
      sessionStorage.setItem(MAX_RATING_STORAGE_KEY, newMaxRating.toString());
      sessionStorage.setItem(EXCLUDE_NATIONS_STORAGE_KEY, newExcludeNations.toString()); // Persist new setting
      sessionStorage.setItem(SELECTED_VERSION_STORAGE_KEY, newSelectedVersion); // Persist new version setting
      sessionStorage.setItem(MAX_OVR_DIFF_STORAGE_KEY, newMaxOvrDiff.toString()); // Persist new max OVR diff setting
    } catch (error) {
      console.error("Error saving settings to sessionStorage:", error);
    }
    setError(null);
    // Modal closing is handled within SettingsModal component itself
  };

  // --- Player Name Update Handler ---
  const handleUpdatePlayerName = async (playerId: string, newName: string): Promise<boolean> => {
    console.log(`[App] Attempting to update player ${playerId} to name: ${newName}`);
    try {
      const { error } = await supabase
        .from('players')
        .update({ name: newName })
        .eq('id', playerId)
        .select()
        .single();

      if (error) {
        console.error(`[App] Error updating player ${playerId} in DB:`, error);
        throw error;
      }

      console.log(`[App] Player ${playerId} updated successfully in DB.`);
      setAllPlayers(prevPlayers =>
        prevPlayers.map(p => (p.id === playerId ? { ...p, name: newName } : p))
      );
      console.log(`[App] Player ${playerId} updated successfully locally.`);
      return true;

    } catch (err) {
        console.error(`[App] Error updating player ${playerId} in DB:`, err);
      return false;
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

  // Page Navigation Handlers
  const handleNavigateToAllMatches = () => {
    setCurrentPage('allMatches');
  };

  const handleNavigateToMain = () => {
    setCurrentPage('main');
  };

  // Refresh handler for AllMatches page
  const handleRefreshAllMatches = () => {
    fetchAllMatches();
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
    const teamMap = new Map(allTeams.map(t => [t.id, t]));

    allPlayers.forEach(player => {
      standingsMap.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        totalOverallRating: 0,
        matchesPlayed: 0,
      });
    });

    matchesToday.forEach(match => {
      const team1 = teamMap.get(match.team1_id);
      const team2 = teamMap.get(match.team2_id);

      const hasScores = match.team1_score !== null && match.team2_score !== null;
      let winnerTeamNumber: 1 | 2 | null = null;
      if (hasScores) {
        const score1 = match.team1_score!;
        const score2 = match.team2_score!;
        if (score1 > score2) winnerTeamNumber = 1;
        else if (score2 > score1) winnerTeamNumber = 2;
        // Check for penalties winner if scores are equal
        else if (score1 === score2 && match.penalties_winner) {
          winnerTeamNumber = match.penalties_winner;
        }
      }

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
          if (team1) {
            standing.totalOverallRating += team1.overallRating;
            standing.matchesPlayed += 1;
          }
        }
      });

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
          if (team2) {
            standing.totalOverallRating += team2.overallRating;
            standing.matchesPlayed += 1;
          }
        }
      });
    });

    const standingsArray = Array.from(standingsMap.values()).map(s => ({
        ...s,
        goalDifference: s.goalsFor - s.goalsAgainst
    }));

    standingsArray.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    console.log("[App] Player standings calculated:", standingsArray);
    return standingsArray;

  }, [matchesToday, allPlayers, allTeams]);

  // Calculate Overall Player Standings (all matches)
  const overallPlayerStandings = useMemo(() => {
    console.log("[App] Calculating overall player standings...");
    const standingsMap = new Map<string, PlayerStanding>();
    const teamMap = new Map(allTeams.map(t => [t.id, t]));

    allPlayers.forEach(player => {
      standingsMap.set(player.id, {
        playerId: player.id,
        playerName: player.name,
        points: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        totalOverallRating: 0,
        matchesPlayed: 0,
      });
    });

    allMatches.forEach(match => {
      const team1 = teamMap.get(match.team1_id);
      const team2 = teamMap.get(match.team2_id);

      const hasScores = match.team1_score !== null && match.team2_score !== null;
      let winnerTeamNumber: 1 | 2 | null = null;
      if (hasScores) {
        const score1 = match.team1_score!;
        const score2 = match.team2_score!;
        if (score1 > score2) winnerTeamNumber = 1;
        else if (score2 > score1) winnerTeamNumber = 2;
        // Check for penalties winner if scores are equal
        else if (score1 === score2 && match.penalties_winner) {
          winnerTeamNumber = match.penalties_winner;
        }
      }

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
          if (team1) {
            standing.totalOverallRating += team1.overallRating;
            standing.matchesPlayed += 1;
          }
        }
      });

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
          if (team2) {
            standing.totalOverallRating += team2.overallRating;
            standing.matchesPlayed += 1;
          }
        }
      });
    });

    const standingsArray = Array.from(standingsMap.values()).map(s => ({
        ...s,
        goalDifference: s.goalsFor - s.goalsAgainst
    }));

    standingsArray.sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.goalDifference !== a.goalDifference) return b.goalDifference - a.goalDifference;
      return b.goalsFor - a.goalsFor;
    });

    console.log("[App] Overall player standings calculated:", standingsArray);
    return standingsArray;

  }, [allMatches, allPlayers, allTeams]);

  // Calculate Team Statistics (all matches)
  const teamStatistics = useMemo(() => {
    console.log("[App] Calculating team statistics...");
    const statsMap = new Map<string, TeamStanding>();

    // Initialize all teams
    allTeams.forEach(team => {
      statsMap.set(team.id, {
        teamId: team.id,
        teamName: team.name,
        logoUrl: team.logoUrl,
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        winPercentage: 0,
        lossPercentage: 0,
      });
    });

    // Process all matches
    allMatches.forEach(match => {
      const team1Stats = statsMap.get(match.team1_id);
      const team2Stats = statsMap.get(match.team2_id);

      const hasScores = match.team1_score !== null && match.team2_score !== null;
      if (!hasScores || !team1Stats || !team2Stats) return;

      // Increment matches played for both teams
      team1Stats.totalMatches += 1;
      team2Stats.totalMatches += 1;

      const score1 = match.team1_score!;
      const score2 = match.team2_score!;

      // Determine winner
      let winnerTeamNumber: 1 | 2 | null = null;
      if (score1 > score2) {
        winnerTeamNumber = 1;
      } else if (score2 > score1) {
        winnerTeamNumber = 2;
      } else if (score1 === score2 && match.penalties_winner) {
        winnerTeamNumber = match.penalties_winner;
      }

      // Update win/loss counts
      if (winnerTeamNumber === 1) {
        team1Stats.totalWins += 1;
        team2Stats.totalLosses += 1;
      } else if (winnerTeamNumber === 2) {
        team2Stats.totalWins += 1;
        team1Stats.totalLosses += 1;
      }
      // Note: Draws (when no penalties winner) don't count as wins or losses
    });

    // Calculate percentages
    const statsArray = Array.from(statsMap.values()).map(stats => ({
      ...stats,
      winPercentage: stats.totalMatches > 0 ? (stats.totalWins / stats.totalMatches) * 100 : 0,
      lossPercentage: stats.totalMatches > 0 ? (stats.totalLosses / stats.totalMatches) * 100 : 0,
    }));

    console.log("[App] Team statistics calculated:", statsArray);
    return statsArray;

  }, [allMatches, allTeams]);


  return (
    <div className="flex flex-col min-h-screen"> {/* Changed to flex-col */}
      <Header /> {/* Add the Header component */}
      <AuthWrapper>
        <main className="grow bg-linear-to-br from-brand-lighter via-brand-light to-brand-medium p-4 flex flex-col items-center">
        {/* Removed the old h1 title */}

        {loading && <p className="text-gray-600 mt-8">Loading initial data...</p>}
        {error && <p className="text-red-600 bg-red-100 p-3 rounded-sm text-center mb-4 max-w-xl mx-auto mt-8">{error}</p>}

        {/* Match Display */}
        {!loading && !error && match && (
          <div className="w-full max-w-4xl mb-6 mt-8"> {/* Added mt-8 */}
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
              <TeamCard team={match[0]} differences={team1Differences} onEdit={() => handleOpenEditModal(0)} />
              <div className="text-2xl font-bold text-gray-700 my-2 md:my-0">VS</div>
              <TeamCard team={match[1]} differences={team2Differences} onEdit={() => handleOpenEditModal(1)} />
            </div>
          </div>
        )}
         {!loading && !error && !match && filteredTeams.length >= 2 && !canGenerateNewMatch && (
           <p className="text-yellow-700 bg-yellow-100 p-3 rounded-sm mb-6 text-center max-w-md mt-8"> {/* Added mt-8 */}
              No valid matchup displayed. All teams within the current filter have played today.
           </p>
         )}

         {/* Buttons Container */}
         {!loading && !error && allTeams.length > 0 && currentPage === 'main' && (
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
               <AdminOnly>
                 <button
                   onClick={handleOpenAddMatchModal}
                   className="flex items-center justify-center px-5 py-2.5 bg-brand-dark text-white font-semibold hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed border-r border-white/20"
                   disabled={!match}
                   title="Add Current Matchup to History"
                 >
                   <PlusSquare className="w-5 h-5 mr-2" /> Add Match
                 </button>
               </AdminOnly>
               <button
                 onClick={handleNavigateToAllMatches}
                 className="flex items-center justify-center px-5 py-2.5 bg-brand-dark text-white font-semibold hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out border-r border-white/20"
                 title="View and Edit All Matches"
               >
                 <List className="w-5 h-5 mr-2" /> All Matches
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

         {/* All Matches Page Back Button */}
         {currentPage === 'allMatches' && (
           <div className="flex items-center justify-center mb-6">
             <button
               onClick={handleNavigateToMain}
               className="flex items-center justify-center px-5 py-2.5 bg-brand-dark text-white font-semibold hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out rounded-lg shadow-md"
               title="Back to Main Page"
             >
               <ArrowLeft className="w-5 h-5 mr-2" /> Back to Main
             </button>
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

         {/* Main Page Content */}
         {currentPage === 'main' && (
           <>
             {/* Match History */}
             {!loading && !error && (
                 <MatchHistory matchesToday={matchesToday} loading={loadingHistory} error={historyError} onRefresh={handleManualRefreshHistory} allPlayers={allPlayers} />
             )}

             {/* Player Standings */}
             {!loading && !error && (
                  <PlayerStandings standings={playerStandings} loading={loadingHistory} error={historyError} title="Player Standings (Today)" matches={matchesToday} />
             )}

             {/* Overall Player Standings */}
             {!loading && !error && (
                  <PlayerStandings
                    standings={overallPlayerStandings}
                    loading={loadingAllMatches}
                    error={allMatchesError}
                    title="Player Standings (Overall)"
                    matches={allMatches}
                    allPlayers={allPlayers}
                    allTeams={allTeams}
                    enableVersionFilter={true}
                  />
             )}

             {/* Player Top Teams */}
             {!loading && !error && (
                  <PlayerTopTeams
                    allPlayers={allPlayers}
                    allMatches={allMatches}
                    allTeams={allTeams}
                    loading={loadingAllMatches}
                    error={allMatchesError}
                  />
             )}

             {/* Top Win Percentage Teams */}
             {!loading && !error && (
                  <TopWinPercentageTeams teamStandings={teamStatistics} loading={loadingAllMatches} error={allMatchesError} allMatches={allMatches} />
             )}

             {/* Top Loss Percentage Teams */}
             {!loading && !error && (
                  <TopLossPercentageTeams teamStandings={teamStatistics} loading={loadingAllMatches} error={allMatchesError} allMatches={allMatches} />
             )}

             {/* Player Win Percentage Matrix */}
             {!loading && !error && (
                  <PlayerWinMatrix allPlayers={allPlayers} allMatches={allMatches} loading={loadingAllMatches} error={allMatchesError} />
             )}

              User Management - Admin Only
             <AdminOnly>
               {!loading && !error && (
                 <UserManagement />
               )}
             </AdminOnly>
           </>
         )}

         {/* All Matches Page Content */}
         {currentPage === 'allMatches' && (
             <AllMatches 
               allMatches={allMatches} 
               loading={loadingAllMatches} 
               error={allMatchesError} 
               onRefresh={handleRefreshAllMatches} 
               allPlayers={allPlayers} 
             />
         )}
      </main>

      {/* Modals */}
      <EditTeamModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} allTeams={filteredTeams.filter(team => !playedTeamIdsToday.has(team.id))} onTeamSelected={handleUpdateTeam} currentTeam={editingTeamIndex !== null && match ? match[editingTeamIndex] : undefined} />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
        onSave={handleSaveSettings}
        initialMinRating={minRating}
        initialMaxRating={maxRating}
        initialExcludeNations={excludeNations} // Pass initial state
        initialSelectedVersion={selectedVersion} // Pass initial version state
        initialMaxOvrDiff={maxOvrDiff} // Pass initial max OVR diff state
        allPlayers={allPlayers}
        onUpdatePlayerName={handleUpdatePlayerName}
      />
       <AddMatchModal isOpen={isAddMatchModalOpen} onClose={handleCloseAddMatchModal} matchTeams={match} onMatchSaved={handleMatchSaved} />
      </AuthWrapper>
    </div>
  );
}

export default App;
