import React, { useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Player, MatchHistoryItem } from '../types';
import { Save, RefreshCw, ChevronDown, ChevronUp, X, Trash2, Shield, Award, Plus } from 'lucide-react';
import { AdminOnly } from './RoleBasedComponents'; // Import Shield and Award

interface MatchHistoryProps {
  matchesToday: MatchHistoryItem[];
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


const MatchHistory: React.FC<MatchHistoryProps> = ({
  matchesToday,
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
  const [logoErrors, setLogoErrors] = useState<LogoErrorState>({}); // State for logo errors
  
  // Player editing state
  const [editingPlayersMatchId, setEditingPlayersMatchId] = useState<string | null>(null);
  const [savingPlayers, setSavingPlayers] = useState<boolean>(false);
  
  // Add player state
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [addingToTeam, setAddingToTeam] = useState<1 | 2 | null>(null);

  // Function to handle logo loading errors
  const handleLogoError = (matchId: string, teamNumber: 1 | 2) => {
    const key = `${matchId}-team${teamNumber}`;
    setLogoErrors(prevErrors => ({ ...prevErrors, [key]: true }));
  };

  // Reset logo errors when matchesToday changes (e.g., on refresh)
  React.useEffect(() => {
    setLogoErrors({});
  }, [matchesToday]);


  const highlightedMatchIds = useMemo(() => {
    let maxDiff = -1;
    const completedMatches = matchesToday.filter(
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
  }, [matchesToday]);

  const handleEditScoreClick = (match: MatchHistoryItem) => {
    setEditingScoreMatchId(match.id);
    setScore1Input(match.team1_score?.toString() ?? '');
    setScore2Input(match.team2_score?.toString() ?? '');
    setPenaltiesWinner(match.penalties_winner);
  };

  const handleCancelEditScore = () => {
    setEditingScoreMatchId(null);
    setScore1Input('');
    setScore2Input('');
    setPenaltiesWinner(null);
  };

  const handleSaveScore = async (matchId: string) => {
    const score1 = parseInt(score1Input, 10);
    const score2 = parseInt(score2Input, 10);

    if (isNaN(score1) || isNaN(score2) || score1 < 0 || score2 < 0) {
      alert('Please enter valid non-negative scores.');
      return;
    }

    // If scores are equal, ensure a penalties winner is selected
    if (score1 === score2 && penaltiesWinner === null) {
      alert('For a draw, please select which team won on penalties.');
      return;
    }

    // If scores are not equal, reset penalties winner
    const finalPenaltiesWinner = score1 === score2 ? penaltiesWinner : null;

    setSavingScore(true);
    try {
      const { error: updateError } = await supabase
        .from('matches')
        .update({ 
          team1_score: score1, 
          team2_score: score2,
          penalties_winner: finalPenaltiesWinner
        })
        .eq('id', matchId);

      if (updateError) throw updateError;

      setEditingScoreMatchId(null);
      setPenaltiesWinner(null);
      onRefresh();

    } catch (err: any) {
      console.error('Error updating score:', err);
      alert('Failed to save score.');
    } finally {
      setSavingScore(false);
    }
  };

  const handleDeleteMatch = async (matchId: string, team1Name: string, team2Name: string) => {
    const confirmed = window.confirm(`Are you sure you want to delete the match: ${team1Name} vs ${team2Name}? This action cannot be undone.`);
    if (!confirmed) {
      return;
    }

    setDeletingMatchId(matchId);
    try {
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId);

      if (deleteError) throw deleteError;

      console.log(`Match ${matchId} deleted successfully.`);
      onRefresh();

    } catch (err: any) {
      console.error('Error deleting match:', err);
      alert('Failed to delete match.');
    } finally {
      setDeletingMatchId(null);
    }
  };


  const toggleExpandMatch = (matchId: string) => {
    setExpandedMatchId(prevId => (prevId === matchId ? null : matchId));
  };

  // Player editing handlers
  const handleEditPlayersClick = (matchId: string) => {
    setEditingPlayersMatchId(matchId);
  };

  const handleCancelEditPlayers = () => {
    setEditingPlayersMatchId(null);
  };

  const handleMovePlayerToTeam = async (playerId: string, matchId: string, newTeamNumber: 1 | 2) => {
    setSavingPlayers(true);
    try {
      const { error } = await supabase
        .from('match_players')
        .update({ team_number: newTeamNumber })
        .eq('match_id', matchId)
        .eq('player_id', playerId);

      if (error) throw error;

      // Refresh the data to show updated player assignments
      onRefresh();
    } catch (err: any) {
      console.error('Error moving player:', err);
      alert('Failed to move player to team.');
    } finally {
      setSavingPlayers(false);
    }
  };

  const handleSavePlayers = () => {
    setEditingPlayersMatchId(null);
    setSelectedPlayerId('');
    setAddingToTeam(null);
  };

  const handleAddPlayerToTeam = async (matchId: string, teamNumber: 1 | 2) => {
    if (!selectedPlayerId) {
      alert('Please select a player to add.');
      return;
    }

    setSavingPlayers(true);
    try {
      const { error } = await supabase
        .from('match_players')
        .insert({
          match_id: matchId,
          player_id: selectedPlayerId,
          team_number: teamNumber
        });

      if (error) throw error;

      // Reset the selection
      setSelectedPlayerId('');
      setAddingToTeam(null);
      
      // Refresh the data to show the newly added player
      onRefresh();
    } catch (err: any) {
      console.error('Error adding player to team:', err);
      alert('Failed to add player to team.');
    } finally {
      setSavingPlayers(false);
    }
  };

  // Helper function to get available players for a match (excluding those already in the match)
  const getAvailablePlayersForMatch = (match: MatchHistoryItem) => {
    const playersInMatch = new Set([
      ...match.team1_players.map(p => p.id),
      ...match.team2_players.map(p => p.id)
    ]);
    return allPlayers.filter(player => !playersInMatch.has(player.id));
  };

  return (
    <div className="w-full max-w-4xl mt-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-gray-700">Today's Matches</h2>
        <button
            onClick={onRefresh}
            className="p-2 text-gray-500 hover:text-brand-dark disabled:opacity-50"
            disabled={loading || savingScore || !!deletingMatchId}
            aria-label="Refresh match history"
            title="Refresh History"
        >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && matchesToday.length === 0 && <p className="text-center text-gray-600">Loading history...</p>}
      {error && <p className="text-center text-red-600 bg-red-100 p-3 rounded-sm">{error}</p>}
      {!loading && !error && matchesToday.length === 0 && (
        <p className="text-center text-gray-500">No matches recorded today.</p>
      )}

      {!loading && !error && matchesToday.length > 0 && (
        <ul className="space-y-4">
          {matchesToday.map((match) => {
            const shouldHighlight = highlightedMatchIds.has(match.id);
            // Use brand colors for background, keep yellow highlight distinct
            const highlightClasses = shouldHighlight ? 'border-yellow-400 border-2 shadow-lg bg-yellow-50' : 'border-brand-light bg-brand-lighter';
            const isDeletingThisMatch = deletingMatchId === match.id;
            const logo1Error = logoErrors[`${match.id}-team1`];
            const logo2Error = logoErrors[`${match.id}-team2`];

            return (
              <li key={match.id} className={`rounded-lg shadow-sm p-4 border transition-all duration-200 ${highlightClasses} ${isDeletingThisMatch ? 'opacity-50' : ''}`}>
                <div className="flex flex-col sm:flex-row justify-between items-center mb-2">
                   {/* Teams and Score */}
                   <div className="flex items-center space-x-2 grow mb-2 sm:mb-0 min-w-0">
                      {/* Team 1 Logo/Fallback */}
                      <div className="w-6 h-6 flex items-center justify-center shrink-0 bg-gray-100 rounded-sm overflow-hidden text-gray-400">
                        {logo1Error ? (
                          <Shield className="w-5 h-5" aria-label="Team 1 logo fallback" />
                        ) : (
                          <img
                            src={match.team1_logoUrl}
                            alt={match.team1_name}
                            className="w-full h-full object-contain"
                            onError={() => handleLogoError(match.id, 1)}
                          />
                        )}
                      </div>
                      <span className="font-medium truncate shrink-0 w-24 sm:w-auto text-gray-800">{match.team1_name}</span>
                      {editingScoreMatchId === match.id ? (
                          <div className="flex flex-col items-center mx-2 shrink-0">
                              <div className="flex items-center space-x-1">
                                  <input
                                      type="number"
                                      value={score1Input}
                                      onChange={(e) => setScore1Input(e.target.value)}
                                      className="w-12 px-1 py-0.5 border border-gray-300 rounded-sm text-center"
                                      min="0"
                                      disabled={savingScore || isDeletingThisMatch}
                                  />
                                  <span>-</span>
                                  <input
                                      type="number"
                                      value={score2Input}
                                      onChange={(e) => setScore2Input(e.target.value)}
                                      className="w-12 px-1 py-0.5 border border-gray-300 rounded-sm text-center"
                                      min="0"
                                      disabled={savingScore || isDeletingThisMatch}
                                  />
                              </div>

                              {/* Penalties winner selection - only shown when scores are equal */}
                              {score1Input && score2Input && parseInt(score1Input) === parseInt(score2Input) && (
                                  <div className="mt-2 text-xs">
                                      <p className="font-medium mb-1 text-gray-600">Penalties winner:</p>
                                      <div className="flex space-x-2">
                                          <button
                                              onClick={() => setPenaltiesWinner(1)}
                                              className={`px-2 py-1 rounded-sm text-xs ${penaltiesWinner === 1 
                                                  ? 'bg-brand-medium text-white' 
                                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                              disabled={savingScore || isDeletingThisMatch}
                                          >
                                              {match.team1_name}
                                          </button>
                                          <button
                                              onClick={() => setPenaltiesWinner(2)}
                                              className={`px-2 py-1 rounded-sm text-xs ${penaltiesWinner === 2 
                                                  ? 'bg-brand-medium text-white' 
                                                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                                              disabled={savingScore || isDeletingThisMatch}
                                          >
                                              {match.team2_name}
                                          </button>
                                      </div>
                                  </div>
                              )}
                          </div>
                      ) : (
                          <span className={`text-lg font-bold mx-2 shrink-0 ${shouldHighlight ? 'text-yellow-700' : 'text-gray-700'}`}>
                              {match.team1_score !== null && match.team2_score !== null ? (
                                  <>
                                      {`${match.team1_score} - ${match.team2_score}`}
                                      {match.team1_score === match.team2_score && match.penalties_winner && (
                                          <span className="ml-1 text-xs text-gray-500">
                                              (Pen: {match.penalties_winner === 1 ? match.team1_name : match.team2_name})
                                          </span>
                                      )}
                                  </>
                              ) : 'vs'}
                          </span>
                      )}
                      {/* Team 2 Logo/Fallback */}
                       <div className="w-6 h-6 flex items-center justify-center shrink-0 bg-gray-100 rounded-sm overflow-hidden text-gray-400">
                        {logo2Error ? (
                          <Shield className="w-5 h-5" aria-label="Team 2 logo fallback" />
                        ) : (
                          <img
                            src={match.team2_logoUrl}
                            alt={match.team2_name}
                            className="w-full h-full object-contain"
                            onError={() => handleLogoError(match.id, 2)}
                          />
                        )}
                      </div>
                      <span className="font-medium truncate shrink-0 w-24 sm:w-auto text-gray-800">{match.team2_name}</span>
                   </div>

                   {/* Action Buttons */}
                   <div className="flex items-center space-x-2 shrink-0">
                      {editingScoreMatchId === match.id ? (
                          <>
                              <button
                                  onClick={() => handleSaveScore(match.id)}
                                  className="p-1 bg-brand-medium text-white rounded-sm hover:bg-brand-dark disabled:opacity-50"
                                  disabled={savingScore || isDeletingThisMatch}
                                  title="Save Score"
                              >
                                  <Save className="w-4 h-4" />
                              </button>
                              <button
                                  onClick={handleCancelEditScore}
                                  className="p-1 bg-gray-400 text-white rounded-sm hover:bg-gray-500 disabled:opacity-50"
                                  disabled={savingScore || isDeletingThisMatch}
                                  title="Cancel Edit"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          </>
                      ) : (
                          <AdminOnly>
                            <button
                                onClick={() => handleEditScoreClick(match)}
                                className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-sm hover:bg-blue-200 disabled:opacity-50" // Kept blue for edit/add score for now
                                disabled={savingScore || loading || !!deletingMatchId}
                                title={match.team1_score !== null ? 'Edit Score' : 'Add Score'}
                            >
                                {match.team1_score !== null ? 'Edit Score' : 'Add Score'}
                            </button>
                          </AdminOnly>
                      )}
                      {/* Edit Players Button - only shown when match is expanded */}
                      <AdminOnly>
                        {expandedMatchId === match.id && editingPlayersMatchId !== match.id && (
                            <button
                                onClick={() => handleEditPlayersClick(match.id)}
                                className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded-sm hover:bg-green-200 disabled:opacity-50"
                                disabled={savingScore || savingPlayers || loading || !!deletingMatchId}
                                title="Edit Player Teams"
                            >
                                Edit Players
                            </button>
                        )}
                      </AdminOnly>
                      {/* Save/Cancel Players Buttons - shown when editing players */}
                      {editingPlayersMatchId === match.id && (
                          <>
                              <button
                                  onClick={handleSavePlayers}
                                  className="p-1 bg-brand-medium text-white rounded-sm hover:bg-brand-dark disabled:opacity-50"
                                  disabled={savingPlayers}
                                  title="Done Editing Players"
                              >
                                  <Save className="w-4 h-4" />
                              </button>
                              <button
                                  onClick={handleCancelEditPlayers}
                                  className="p-1 bg-gray-400 text-white rounded-sm hover:bg-gray-500 disabled:opacity-50"
                                  disabled={savingPlayers}
                                  title="Cancel Edit Players"
                              >
                                  <X className="w-4 h-4" />
                              </button>
                          </>
                      )}
                       <button
                          onClick={() => toggleExpandMatch(match.id)}
                          className="p-1 text-gray-500 hover:text-brand-dark disabled:opacity-50"
                          title={expandedMatchId === match.id ? "Collapse Players" : "Expand Players"}
                          disabled={savingScore || savingPlayers || loading || !!deletingMatchId}
                      >
                          {expandedMatchId === match.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                      <AdminOnly>
                        <button
                            onClick={() => handleDeleteMatch(match.id, match.team1_name, match.team2_name)}
                            className={`p-1 text-red-500 hover:text-red-700 rounded-sm hover:bg-red-100 disabled:opacity-50 ${isDeletingThisMatch ? 'animate-pulse' : ''}`} // Kept red for delete
                            disabled={savingScore || loading || !!deletingMatchId}
                            title="Delete Match"
                        >
                            {isDeletingThisMatch ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        </button>
                      </AdminOnly>
                   </div>
                </div>

                {/* Expanded Player List */}
                {expandedMatchId === match.id && (
                  <div className="mt-3 pt-3 border-t border-brand-light text-xs text-gray-600 grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                      <div>
                          <strong className="block mb-1 text-gray-700">{match.team1_name} Players:</strong>
                          {match.team1_players.length > 0 ? (
                              <ul className="space-y-1">
                                  {match.team1_players.map(p => (
                                      <li key={p.id} className="flex items-center justify-between">
                                          <span>{p.name}</span>
                                          {editingPlayersMatchId === match.id && (
                                              <button
                                                  onClick={() => handleMovePlayerToTeam(p.id, match.id, 2)}
                                                  className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-sm hover:bg-blue-200 disabled:opacity-50"
                                                  disabled={savingPlayers}
                                                  title={`Move to ${match.team2_name}`}
                                              >
                                                  →
                                              </button>
                                          )}
                                      </li>
                                  ))}
                              </ul>
                          ) : <span className="italic">No players recorded</span>}
                      </div>
                       <div>
                          <strong className="block mb-1 text-gray-700">{match.team2_name} Players:</strong>
                          {match.team2_players.length > 0 ? (
                              <ul className="space-y-1">
                                  {match.team2_players.map(p => (
                                      <li key={p.id} className="flex items-center justify-between">
                                          <span>{p.name}</span>
                                          {editingPlayersMatchId === match.id && (
                                              <button
                                                  onClick={() => handleMovePlayerToTeam(p.id, match.id, 1)}
                                                  className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 rounded-sm hover:bg-blue-200 disabled:opacity-50"
                                                  disabled={savingPlayers}
                                                  title={`Move to ${match.team1_name}`}
                                              >
                                                  ←
                                              </button>
                                          )}
                                      </li>
                                  ))}
                              </ul>
                          ) : <span className="italic">No players recorded</span>}
                      </div>
                      
                      {/* Add Player Section - only shown when editing players */}
                      {editingPlayersMatchId === match.id && (
                          <div className="col-span-1 sm:col-span-2 mt-3 pt-3 border-t border-gray-200">
                              <div className="flex flex-col sm:flex-row items-center gap-2 mb-2">
                                  <select
                                      value={selectedPlayerId}
                                      onChange={(e) => setSelectedPlayerId(e.target.value)}
                                      className="text-xs border border-gray-300 rounded-sm px-2 py-1 bg-white"
                                      disabled={savingPlayers}
                                  >
                                      <option value="">Select a player to add...</option>
                                      {getAvailablePlayersForMatch(match).map(player => (
                                          <option key={player.id} value={player.id}>{player.name}</option>
                                      ))}
                                  </select>
                                  <div className="flex gap-2">
                                      <button
                                          onClick={() => handleAddPlayerToTeam(match.id, 1)}
                                          className="flex items-center text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-sm hover:bg-purple-200 disabled:opacity-50"
                                          disabled={!selectedPlayerId || savingPlayers}
                                          title={`Add to ${match.team1_name}`}
                                      >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add to {match.team1_name}
                                      </button>
                                      <button
                                          onClick={() => handleAddPlayerToTeam(match.id, 2)}
                                          className="flex items-center text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-sm hover:bg-purple-200 disabled:opacity-50"
                                          disabled={!selectedPlayerId || savingPlayers}
                                          title={`Add to ${match.team2_name}`}
                                      >
                                          <Plus className="w-3 h-3 mr-1" />
                                          Add to {match.team2_name}
                                      </button>
                                  </div>
                              </div>
                              {getAvailablePlayersForMatch(match).length === 0 && (
                                  <p className="text-xs text-gray-500 italic">All players are already in this match</p>
                              )}
                          </div>
                      )}
                  </div>
                )}
                 <div className="text-right text-xs text-gray-400 mt-1">
                   Played: {formatDateTimeEuropean(match.played_at)} {/* Use the formatting function */}
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
