import { useState, useCallback, useEffect } from 'react';
import { Team, Player, MatchPlayer, MatchHistoryItem } from '../types';
import { supabase } from '../lib/supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';

// Fetch all teams from Supabase
export const fetchAllTeams = async (): Promise<Team[]> => {
  console.log("Fetching all teams...");
  const { data, error } = await supabase.from('teams').select('*');
  if (error) {
    console.error("Error fetching teams:", error);
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }
  return data || [];
};

// Fetch all players from Supabase
export const fetchAllPlayers = async (): Promise<Player[]> => {
  console.log("Fetching all players...");
  const { data, error } = await supabase.from('players').select('*').order('name');
  if (error) {
    console.error("Error fetching players:", error);
    throw new Error(`Failed to fetch players: ${error.message}`);
  }
  return data || [];
};

/**
 * Combines raw match data with team and player info into MatchHistoryItem[].
 */
function combineMatchData(
  matchesData: any[],
  matchPlayersData: MatchPlayer[],
  allTeams: Team[],
  allPlayers: Player[]
): MatchHistoryItem[] {
  const playerMap = new Map(allPlayers.map(p => [p.id, p]));
  const teamMap = new Map(allTeams.map(t => [t.id, t]));

  return matchesData.map(match => {
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
}

export function useMatchData(allTeams: Team[], allPlayers: Player[]) {
  const [matchesToday, setMatchesToday] = useState<MatchHistoryItem[]>([]);
  const [allMatches, setAllMatches] = useState<MatchHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [loadingAllMatches, setLoadingAllMatches] = useState<boolean>(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [allMatchesError, setAllMatchesError] = useState<string | null>(null);
  const [refreshHistoryTrigger, setRefreshHistoryTrigger] = useState<number>(0);

  // Fetch Today's Match History
  const fetchTodaysMatches = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    console.log("[useMatchData] Fetching today's matches...");

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setDate(todayStart.getDate() + 1);

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

      const combinedMatches = combineMatchData(matchesData, matchPlayersData, allTeams, allPlayers);
      console.log("[useMatchData] Today's matches fetched:", combinedMatches);
      setMatchesToday(combinedMatches);

    } catch (err) {
      console.error('[useMatchData] Error fetching match history:', err);
      setHistoryError('Failed to load match history.');
      setMatchesToday([]);
    } finally {
      setLoadingHistory(false);
    }
  }, [allTeams, allPlayers]);

  // Fetch All Matches (for overall standings)
  const fetchAllMatchesData = useCallback(async () => {
    setLoadingAllMatches(true);
    setAllMatchesError(null);
    console.log("[useMatchData] Fetching all matches...");

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

      const combinedMatches = combineMatchData(matchesData, matchPlayersData, allTeams, allPlayers);
      console.log("[useMatchData] All matches fetched:", combinedMatches);
      setAllMatches(combinedMatches);

    } catch (err) {
      console.error('[useMatchData] Error fetching all matches:', err);
      setAllMatchesError('Failed to load all match history.');
      setAllMatches([]);
    } finally {
      setLoadingAllMatches(false);
    }
  }, [allTeams, allPlayers]);

  // Fetch history once teams/players are loaded, and when triggered
  useEffect(() => {
    if (allTeams.length > 0 && allPlayers.length > 0) {
      fetchTodaysMatches();
      fetchAllMatchesData();
    }
  }, [allTeams, allPlayers, refreshHistoryTrigger, fetchTodaysMatches, fetchAllMatchesData]);

  // Real-time subscription for matches table
  useEffect(() => {
    if (allTeams.length === 0 || allPlayers.length === 0) return;

    console.log("[useMatchData] Setting up real-time subscription on matches table...");
    const channel: RealtimeChannel = supabase
      .channel('matches-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          console.log('[useMatchData] Real-time match change received:', payload.eventType);
          // Trigger a full refetch to keep data consistent
          setRefreshHistoryTrigger(prev => prev + 1);
        }
      )
      .subscribe((status) => {
        console.log('[useMatchData] Realtime subscription status:', status);
      });

    return () => {
      console.log("[useMatchData] Cleaning up real-time subscription...");
      supabase.removeChannel(channel);
    };
  }, [allTeams.length, allPlayers.length]);

  const triggerRefresh = () => {
    setRefreshHistoryTrigger(prev => prev + 1);
  };

  return {
    matchesToday,
    allMatches,
    loadingHistory,
    loadingAllMatches,
    historyError,
    allMatchesError,
    triggerRefresh,
    fetchAllMatchesData,
  };
}
