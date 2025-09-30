import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Player, MatchHistoryItem } from '../types';
import { Save, RefreshCw, ChevronDown, ChevronUp, X, Trash2, Shield, Award } from 'lucide-react';

interface AllMatchesProps {
  allMatches: MatchHistoryItem[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  allPlayers: Player[];
}

// State to track logo errors within the history list
interface LogoErrorState {
  [logoKey: string]: boolean; // e.g., { 'matchId-team1': true, 'matchId-team2': false }
}

// Helper function to format date/time
const formatDateTimeEuropean = (isoString: string): string => {
    try {
        const date = new Date(isoString);
        // Use 'en-GB' for DD/MM/YYYY format, adjust options for 24-hour time
        const options: Intl.DateTimeFormatOptions = {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false, // Use 24-hour format
        };
        return date.toLocaleString('en-GB', options);
    } catch (e) {
        console.error("Error formatting date:", e);
        return "Invalid Date";
    }
};

const AllMatches: React.FC<AllMatchesProps> = ({
  allMatches,
  loading,
  error,
  onRefresh,
  allPlayers,
}) => {
  const [editingScoreMatchId, setEditingScoreMatchId] = useState<string | null>(null);
  const [score1Input, setScore1Input] = useState<string>('');
  const [score2Input, setScore2Input] = useState<string>('');
  const [penaltiesWinner, setPenaltiesWinner] = useState<1 | 2 | null>(null);
  const [savingScore, setSavingScore] = useState<boolean>(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [deletingMatchId, setDeletingMatchId] = useState<string | null>(null);
  const [logoErrors, setLogoErrors] = useState<LogoErrorState>({});

  // Function to handle logo loading errors
  const handleLogoError = (matchId: string, teamNumber: 1 | 2) => {
    const key = `${matchId}-team${teamNumber}`;
    setLogoErrors(prevErrors => ({ ...prevErrors, [key]: true }));
  };

  // Reset logo errors when allMatches changes (e.g., on refresh)
  React.useEffect(() => {
    setLogoErrors({});
  }, [allMatches]);

  const highlightedMatchIds = useMemo(() => {
    let maxDiff = -1;
    const completedMatches = allMatches.filter(
      match => match.team1_score !== null && match.team2_score !== null
    );

    if (completedMatches.length === 0) {
      return new Set<string>();
    }

    completedMatches.forEach(match => {
      const diff = Math.abs(match.team1_score! - match.team2_score!);
      if (diff > maxDiff) {
        maxDiff = diff;
      }
    });

    const matchesWithMaxDiff = completedMatches.filter(match => {
      const diff = Math.abs(match.team1_score! - match.team2_score!);
      return diff === maxDiff;
    });

    if (matchesWithMaxDiff.length <= 1) {
      return new Set<string>(matchesWithMaxDiff.map(m => m.id));
    } else {
      let maxTotalGoals = -1;
      matchesWithMaxDiff.forEach(match => {
        const totalGoals = match.team1_score! + match.team2_score!;
        if (totalGoals > maxTotalGoals) {
          maxTotalGoals = totalGoals;
        }
      });

      const finalMatchesToHighlight = matchesWithMaxDiff.filter(match => {
        const totalGoals = match.team1_score! + match.team2_score!;
        return totalGoals === maxTotalGoals;
      });

      return new Set<string>(finalMatchesToHighlight.map(m => m.id));
    }
  }, [allMatches]);

  const handleEditScoreClick = (match: MatchHistoryItem) => {
    setEditingScoreMatchId(match.id);
    setScore1Input(match.team1_score?.toString() || '');
    setScore2Input(match.team2_score?.toString() || '');
    setPenaltiesWinner(match.penalties_winner);
  };

  const handleCancelEdit = () => {
    setEditingScoreMatchId(null);
    setScore1Input('');
    setScore2Input('');
    setPenaltiesWinner(null);
  };

  const handleSaveScore = async (matchId: string) => {
    setSavingScore(true);
    try {
      const score1 = parseInt(score1Input, 10);
      const score2 = parseInt(score2Input, 10);

      if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
        alert('Please enter valid non-negative integer scores.');
        return;
      }

      const updateData: any = {
        team1_score: score1,
        team2_score: score2,
      };

      // Only include penalties_winner if scores are equal
      if (score1 === score2) {
        updateData.penalties_winner = penaltiesWinner;
      } else {
        updateData.penalties_winner = null;
      }

      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId);

      if (error) throw error;

      console.log('Match score updated successfully');
      handleCancelEdit();
      onRefresh(); // Refresh the match history
    } catch (err: any) {
      console.error('Error updating match score:', err);
      alert(`Failed to update match score: ${err.message}`);
    } finally {
      setSavingScore(false);
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm('Are you sure you want to delete this match? This action cannot be undone.')) {
      return;
    }

    setDeletingMatchId(matchId);
    try {
      // First delete related match_players records
      const { error: playersError } = await supabase
        .from('match_players')
        .delete()
        .eq('match_id', matchId);

      if (playersError) throw playersError;

      // Then delete the match itself
      const { error: matchError } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (matchError) throw matchError;

      console.log('Match deleted successfully');
      onRefresh(); // Refresh the match history
    } catch (err: any) {
      console.error('Error deleting match:', err);
      alert(`Failed to delete match: ${err.message}`);
    } finally {
      setDeletingMatchId(null);
    }
  };

  const handleToggleExpanded = (matchId: string) => {
    setExpandedMatchId(expandedMatchId === matchId ? null : matchId);
  };

  return (
    <div className="w-full max-w-4xl mt-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold text-gray-700">All Matches</h2>
        <button
          onClick={onRefresh}
          className="flex items-center px-3 py-2 text-sm bg-brand-light text-gray-700 hover:bg-brand-medium focus:outline-none focus:ring-2 focus:ring-brand-dark focus:ring-offset-2 rounded-md transition duration-150 ease-in-out"
        >
          <RefreshCw className="w-4 h-4 mr-1" />
          Refresh
        </button>
      </div>

      {loading && <p className="text-center text-gray-600">Loading all matches...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded-sm">{error}</p>}

      {!loading && !error && allMatches.length === 0 && (
        <p className="text-center text-gray-500">No matches found.</p>
      )}

      {!loading && !error && allMatches.length > 0 && (
        <div className="space-y-4">
          {allMatches.map((match) => {
            const isHighlighted = highlightedMatchIds.has(match.id);
            const isExpanded = expandedMatchId === match.id;
            const isEditing = editingScoreMatchId === match.id;
            const isDeleting = deletingMatchId === match.id;
            
            const team1LogoError = logoErrors[`${match.id}-team1`];
            const team2LogoError = logoErrors[`${match.id}-team2`];

            return (
              <div
                key={match.id}
                className={`p-4 rounded-lg border transition-all duration-200 ${
                  isHighlighted
                    ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300 shadow-md'
                    : 'bg-white border-brand-light hover:border-brand-medium'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center flex-1">
                    <div className="text-xs text-gray-500 mr-4 min-w-[120px]">
                      {formatDateTimeEuropean(match.played_at)}
                    </div>

                    <div className="flex items-center justify-center flex-1">
                      <div className="flex items-center justify-end mr-2 min-w-[120px]">
                        {!team1LogoError && (
                          <img
                            src={match.team1_logoUrl}
                            alt={`${match.team1_name} logo`}
                            className="w-6 h-6 object-contain mr-2"
                            onError={() => handleLogoError(match.id, 1)}
                          />
                        )}
                        <span className="text-sm font-medium text-gray-800 text-right truncate">
                          {match.team1_name}
                        </span>
                      </div>

                      <div className="mx-4 text-center min-w-[80px]">
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="number"
                              value={score1Input}
                              onChange={(e) => setScore1Input(e.target.value)}
                              className="w-12 text-center border border-gray-300 rounded px-1 py-1 text-sm"
                              min="0"
                              disabled={savingScore}
                            />
                            <span className="text-gray-500">-</span>
                            <input
                              type="number"
                              value={score2Input}
                              onChange={(e) => setScore2Input(e.target.value)}
                              className="w-12 text-center border border-gray-300 rounded px-1 py-1 text-sm"
                              min="0"
                              disabled={savingScore}
                            />
                          </div>
                        ) : (
                          <span className="text-lg font-bold text-gray-700">
                            {match.team1_score !== null && match.team2_score !== null
                              ? `${match.team1_score} - ${match.team2_score}`
                              : '- - -'}
                          </span>
                        )}
                        
                        {match.penalties_winner && !isEditing && (
                          <div className="text-xs text-amber-600 mt-1 flex items-center justify-center">
                            <Award className="w-3 h-3 mr-1" />
                            Penalties
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-start ml-2 min-w-[120px]">
                        <span className="text-sm font-medium text-gray-800 text-left truncate">
                          {match.team2_name}
                        </span>
                        {!team2LogoError && (
                          <img
                            src={match.team2_logoUrl}
                            alt={`${match.team2_name} logo`}
                            className="w-6 h-6 object-contain ml-2"
                            onError={() => handleLogoError(match.id, 2)}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    {isHighlighted && (
                      <div className="flex items-center text-yellow-600" title="Match of the Day">
                        <Shield className="w-4 h-4" />
                      </div>
                    )}

                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleSaveScore(match.id)}
                          disabled={savingScore}
                          className="flex items-center px-2 py-1 text-xs bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 rounded transition duration-150 ease-in-out disabled:opacity-50"
                        >
                          <Save className="w-3 h-3 mr-1" />
                          {savingScore ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          disabled={savingScore}
                          className="flex items-center px-2 py-1 text-xs bg-gray-600 text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded transition duration-150 ease-in-out disabled:opacity-50"
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleEditScoreClick(match)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline focus:outline-none transition duration-150 ease-in-out"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMatch(match.id)}
                          disabled={isDeleting}
                          className="flex items-center text-xs text-red-600 hover:text-red-800 focus:outline-none transition duration-150 ease-in-out disabled:opacity-50"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          {isDeleting ? 'Deleting...' : 'Delete'}
                        </button>
                        <button
                          onClick={() => handleToggleExpanded(match.id)}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none transition duration-150 ease-in-out"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-700 mb-2">
                      If the match ended in a draw, select the penalties winner:
                    </div>
                    <div className="flex space-x-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="penaltiesWinner"
                          checked={penaltiesWinner === 1}
                          onChange={() => setPenaltiesWinner(1)}
                          className="mr-2"
                          disabled={savingScore || parseInt(score1Input) !== parseInt(score2Input)}
                        />
                        {match.team1_name}
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="penaltiesWinner"
                          checked={penaltiesWinner === 2}
                          onChange={() => setPenaltiesWinner(2)}
                          className="mr-2"
                          disabled={savingScore || parseInt(score1Input) !== parseInt(score2Input)}
                        />
                        {match.team2_name}
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="penaltiesWinner"
                          checked={penaltiesWinner === null}
                          onChange={() => setPenaltiesWinner(null)}
                          className="mr-2"
                          disabled={savingScore}
                        />
                        No Penalties
                      </label>
                    </div>
                  </div>
                )}

                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">{match.team1_name} Players</h4>
                        {match.team1_players.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {match.team1_players.map((player) => (
                              <span key={player.id} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                {player.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No players recorded</p>
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-800 mb-2">{match.team2_name} Players</h4>
                        {match.team2_players.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {match.team2_players.map((player) => (
                              <span key={player.id} className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded-full">
                                {player.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500">No players recorded</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && allMatches.length > 0 && (
        <p className="text-xs text-gray-500 mt-4 text-center">
          All matches are displayed here. You can edit scores, manage penalty winners, expand for player details, or delete matches as needed.
        </p>
      )}
    </div>
  );
};

export default AllMatches;