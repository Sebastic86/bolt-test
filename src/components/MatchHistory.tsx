import React, { useState, useMemo } from 'react'; // Removed useEffect, useCallback as they are no longer needed here
import { supabase } from '../lib/supabaseClient';
import { Player, MatchHistoryItem } from '../types';
import { Save, RefreshCw, ChevronDown, ChevronUp, X } from 'lucide-react';

interface MatchHistoryProps {
  matchesToday: MatchHistoryItem[]; // Receive matches from parent
  loading: boolean; // Receive loading state from parent
  error: string | null; // Receive error state from parent
  onRefresh: () => void; // Receive refresh handler from parent
  allPlayers: Player[]; // Keep for potential future use or context
}

const MatchHistory: React.FC<MatchHistoryProps> = ({
  matchesToday,
  loading,
  error,
  onRefresh,
  allPlayers, // Keep prop
}) => {
  // Score editing state remains local
  const [editingScoreMatchId, setEditingScoreMatchId] = useState<string | null>(null);
  const [score1Input, setScore1Input] = useState<string>('');
  const [score2Input, setScore2Input] = useState<string>('');
  const [savingScore, setSavingScore] = useState<boolean>(false);

  // Player list expansion state remains local
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);

  // Calculate the match ID with the highest goal difference
  const highestGoalDiffMatchId = useMemo(() => {
    let maxDiff = -1;
    let matchIdWithMaxDiff: string | null = null;

    matchesToday.forEach(match => {
      if (match.team1_score !== null && match.team2_score !== null) {
        const diff = Math.abs(match.team1_score - match.team2_score);
        if (diff > maxDiff) {
          maxDiff = diff;
          matchIdWithMaxDiff = match.id;
        }
      }
    });
    // console.log("[MatchHistory] Highest Goal Diff Match ID:", matchIdWithMaxDiff, "Diff:", maxDiff); // DEBUG
    return matchIdWithMaxDiff;
  }, [matchesToday]); // Recalculate only when matchesToday changes

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

    setSavingScore(true);
    try {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ team1_score: score1, team2_score: score2 })
        .eq('id', matchId);

      if (updateError) throw updateError;

      setEditingScoreMatchId(null);
      onRefresh(); // Trigger parent refresh

    } catch (err: any) {
      console.error('Error updating score:', err);
      alert('Failed to save score.');
    } finally {
      setSavingScore(false);
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
            onClick={onRefresh}
            className="p-2 text-gray-500 hover:text-blue-600 disabled:opacity-50"
            disabled={loading || savingScore}
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
          {matchesToday.map((match) => {
            // Determine if this match should be highlighted
            const isHighestDiff = match.id === highestGoalDiffMatchId && match.team1_score !== null; // Ensure it's a completed match
            const highlightClasses = isHighestDiff ? 'border-yellow-400 border-2 shadow-lg bg-yellow-50' : 'border-gray-200 bg-white';

            return (
              <li key={match.id} className={`rounded-lg shadow p-4 border transition-all duration-200 ${highlightClasses}`}>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-2">
                   {/* Teams and Score */}
                   <div className="flex items-center space-x-2 flex-grow mb-2 sm:mb-0 min-w-0">
                      <img src={match.team1_logoUrl} alt={match.team1_name} className="w-6 h-6 object-contain flex-shrink-0"/>
                      <span className="font-medium truncate flex-shrink-0 w-24 sm:w-auto">{match.team1_name}</span>
                      {editingScoreMatchId === match.id ? (
                          <div className="flex items-center space-x-1 mx-2 flex-shrink-0">
                              <input
                                  type="number"
                                  value={score1Input}
                                  onChange={(e) => setScore1Input(e.target.value)}
                                  className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center"
                                  min="0"
                                  disabled={savingScore}
                              />
                              <span>-</span>
                              <input
                                  type="number"
                                  value={score2Input}
                                  onChange={(e) => setScore2Input(e.target.value)}
                                  className="w-12 px-1 py-0.5 border border-gray-300 rounded text-center"
                                  min="0"
                                  disabled={savingScore}
                              />
                          </div>
                      ) : (
                          <span className={`text-lg font-bold mx-2 flex-shrink-0 ${isHighestDiff ? 'text-yellow-700' : ''}`}>
                              {match.team1_score !== null && match.team2_score !== null
                               ? `${match.team1_score} - ${match.team2_score}`
                               : 'vs'}
                          </span>
                      )}
                      <img src={match.team2_logoUrl} alt={match.team2_name} className="w-6 h-6 object-contain flex-shrink-0"/>
                      <span className="font-medium truncate flex-shrink-0 w-24 sm:w-auto">{match.team2_name}</span>
                   </div>

                   {/* Action Buttons */}
                   <div className="flex items-center space-x-2 flex-shrink-0">
                      {editingScoreMatchId === match.id ? (
                          <>
                              <button
                                  onClick={() => handleSaveScore(match.id)}
                                  className="p-1 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                                  disabled={savingScore}
                                  title="Save Score"
                              >
                                  <Save className="w-4 h-4" />
                              </button>
                              <button
                                  onClick={handleCancelEditScore}
                                  className="p-1 bg-gray-400 text-white rounded hover:bg-gray-500 disabled:opacity-50"
                                  disabled={savingScore}
                                  title="Cancel Edit"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          </>
                      ) : (
                          <button
                              onClick={() => handleEditScoreClick(match)}
                              className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                              disabled={savingScore || loading}
                          >
                              {match.team1_score !== null ? 'Edit Score' : 'Add Score'}
                          </button>
                      )}
                       <button
                          onClick={() => toggleExpandMatch(match.id)}
                          className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                          title={expandedMatchId === match.id ? "Collapse Players" : "Expand Players"}
                          disabled={savingScore || loading}
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
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default MatchHistory;
