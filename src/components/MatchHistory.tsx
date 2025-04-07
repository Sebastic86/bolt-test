import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Match, Player, Team, MatchPlayer, MatchHistoryItem } from '../types';
import { Save, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';

interface MatchHistoryProps {
  refreshTrigger: number; // Increment to trigger refresh
  allTeams: Team[]; // Pass all teams for quick lookup
  allPlayers: Player[]; // Pass all players for quick lookup
}

const MatchHistory: React.FC<MatchHistoryProps> = ({ refreshTrigger, allTeams, allPlayers }) => {
  const [matchesToday, setMatchesToday] = useState<MatchHistoryItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [editingScoreMatchId, setEditingScoreMatchId] = useState<string | null>(null);
  const [score1Input, setScore1Input] = useState<string>('');
  const [score2Input, setScore2Input] = useState<string>('');
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  const fetchMatchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Get start and end of today in UTC
      const todayStart = new Date();
      todayStart.setUTCHours(0, 0, 0, 0);
      const todayEnd = new Date(todayStart);
      todayEnd.setUTCDate(todayStart.getUTCDate() + 1);

      // 1. Fetch matches played today
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .gte('played_at', todayStart.toISOString())
        .lt('played_at', todayEnd.toISOString())
        .order('played_at', { ascending: false }); // Show newest first

      if (matchesError) throw matchesError;
      if (!matchesData) {
          setMatchesToday([]);
          setLoading(false);
          return;
      }

      // 2. Fetch players for these matches
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


      // 3. Combine data
      const teamMap = new Map(allTeams.map(t => [t.id, t]));
      const playerMap = new Map(allPlayers.map(p => [p.id, p]));

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
            .map(mp => playerMap.get(mp.player_id))
            .filter((p): p is Player => p !== undefined), // Type guard
          team2_players: playersInMatch
            .filter(mp => mp.team_number === 2)
            .map(mp => playerMap.get(mp.player_id))
            .filter((p): p is Player => p !== undefined), // Type guard
        };
      });

      setMatchesToday(combinedMatches);

    } catch (err: any) {
      console.error('Error fetching match history:', err);
      setError('Failed to load match history.');
      setMatchesToday([]);
    } finally {
      setLoading(false);
    }
  }, [allTeams, allPlayers]); // Depend on teams and players list

  useEffect(() => {
    fetchMatchHistory();
  }, [refreshTrigger, fetchMatchHistory]); // Refetch when trigger changes

  const handleEditScoreClick = (match: MatchHistoryItem) => {
    setEditingScoreMatchId(match.id);
    setScore1Input(match.team1_score?.toString() ?? '');
    setScore2Input(match.team2_score?.toString() ?? '');
  };

  const handleCancelEditScore = () => {
    setEditingScoreMatchId(null);
    setScore1Input('');
    setScore2Input('');
  };

  const handleSaveScore = async (matchId: string) => {
    const score1 = parseInt(score1Input, 10);
    const score2 = parseInt(score2Input, 10);

    if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
      alert('Please enter valid non-negative scores.');
      return;
    }

    setLoading(true); // Indicate saving
    try {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ team1_score: score1, team2_score: score2 })
        .eq('id', matchId);

      if (updateError) throw updateError;

      // Update local state immediately for better UX
      setMatchesToday(prevMatches =>
        prevMatches.map(m =>
          m.id === matchId ? { ...m, team1_score: score1, team2_score: score2 } : m
        )
      );
      setEditingScoreMatchId(null); // Exit edit mode

    } catch (err: any) {
      console.error('Error updating score:', err);
      alert('Failed to save score.');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpandMatch = (matchId: string) => {
    setExpandedMatchId(prevId => (prevId === matchId ? null : matchId));
  };

  return (
    <div className="w-full max-w-4xl mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-700">Today's Matches</h2>
        <button
            onClick={fetchMatchHistory}
            className="p-2 text-gray-500 hover:text-blue-600 disabled:opacity-50"
            disabled={loading}
            aria-label="Refresh match history"
            title="Refresh History"
        >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && matchesToday.length === 0 && <p className="text-center text-gray-600">Loading history...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded">{error}</p>}
      {!loading && !error && matchesToday.length === 0 && (
        <p className="text-center text-gray-500">No matches recorded today.</p>
      )}

      {!loading && !error && matchesToday.length > 0 && (
        <ul className="space-y-4">
          {matchesToday.map((match) => (
            <li key={match.id} className="bg-white rounded-lg shadow p-4 border border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-center mb-2">
                 {/* Teams and Score */}
                 <div className="flex items-center space-x-2 flex-grow mb-2 sm:mb-0">
                    <img src={match.team1_logoUrl} alt={match.team1_name} className="w-6 h-6 object-contain"/>
                    <span className="font-medium truncate w-24 sm:w-auto">{match.team1_name}</span>
                    {editingScoreMatchId === match.id ? (
                        <div className="flex items-center space-x-1 mx-2">
                            <input
                                type="number"
                                value={score1Input}
                                onChange={(e) => setScore1Input(e.target.value)}
                                className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center"
                                min="0"
                                disabled={loading}
                            />
                            <span>-</span>
                            <input
                                type="number"
                                value={score2Input}
                                onChange={(e) => setScore2Input(e.target.value)}
                                className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center"
                                min="0"
                                disabled={loading}
                            />
                        </div>
                    ) : (
                        <span className="text-lg font-bold mx-2">
                            {match.team1_score !== null ? `${match.team1_score} - ${match.team2_score}` : 'vs'}
                        </span>
                    )}
                    <img src={match.team2_logoUrl} alt={match.team2_name} className="w-6 h-6 object-contain"/>
                    <span className="font-medium truncate w-24 sm:w-auto">{match.team2_name}</span>
                 </div>

                 {/* Action Buttons */}
                 <div className="flex items-center space-x-2 flex-shrink-0">
                    {editingScoreMatchId === match.id ? (
                        <>
                            <button
                                onClick={() => handleSaveScore(match.id)}
                                className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                disabled={loading}
                                title="Save Score"
                            >
                                <Save className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleCancelEditScore}
                                className="p-1 bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50"
                                disabled={loading}
                                title="Cancel Edit"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => handleEditScoreClick(match)}
                            className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                            {match.team1_score !== null ? 'Edit Score' : 'Add Score'}
                        </button>
                    )}
                     <button
                        onClick={() => toggleExpandMatch(match.id)}
                        className="p-1 text-gray-500 hover:text-gray-700"
                        title={expandedMatchId === match.id ? "Collapse Players" : "Expand Players"}
                    >
                        {expandedMatchId === match.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                 </div>
              </div>

              {/* Expanded Player List */}
              {expandedMatchId === match.id && (
                <div className="mt-3 pt-3 border-t text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                    <div>
                        <strong className="block mb-1">{match.team1_name} Players:</strong>
                        {match.team1_players.length > 0 ? (
                            <ul className="list-disc list-inside">
                                {match.team1_players.map(p => <li key={p.id}>{p.name}</li>)}
                            </ul>
                        ) : <span className="italic">No players recorded</span>}
                    </div>
                     <div>
                        <strong className="block mb-1">{match.team2_name} Players:</strong>
                        {match.team2_players.length > 0 ? (
                            <ul className="list-disc list-inside">
                                {match.team2_players.map(p => <li key={p.id}>{p.name}</li>)}
                            </ul>
                        ) : <span className="italic">No players recorded</span>}
                    </div>
                </div>
              )}
               <div className="text-right text-xs text-gray-400 mt-1">
                 Played: {new Date(match.played_at).toLocaleString()}
               </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MatchHistory;
