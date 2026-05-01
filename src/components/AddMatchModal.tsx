import React, { useState, useEffect } from 'react';
import { Team, Player } from '../types';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';
import { X, Save, UserPlus, Trash2 } from 'lucide-react';
import TeamLogo from "./TeamLogo.tsx";
import PlayerBadge from './PlayerBadge';

type MatchSaveAction = 'next' | 'rematch';

interface AddMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchTeams: [Team, Team] | null;
  onMatchSaved: (payload: {
    team1Id: string;
    team2Id: string;
    team1Players: Player[];
    team2Players: Player[];
    action: MatchSaveAction;
  }) => void;
  initialTeam1Players?: Player[];
  initialTeam2Players?: Player[];
}

const MAX_PLAYERS_PER_TEAM = 4;

const AddMatchModal: React.FC<AddMatchModalProps> = ({
  isOpen,
  onClose,
  matchTeams,
  onMatchSaved,
  initialTeam1Players,
  initialTeam2Players,
}) => {
  const { user } = useAuth();
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [team1Players, setTeam1Players] = useState<Player[]>([]);
  const [team2Players, setTeam2Players] = useState<Player[]>([]);
  const [selectedPlayerId1, setSelectedPlayerId1] = useState<string>('');
  const [selectedPlayerId2, setSelectedPlayerId2] = useState<string>('');
  const [loadingPlayers, setLoadingPlayers] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoadingPlayers(true);
      setError(null);
      setSelectedPlayerId1('');
      setSelectedPlayerId2('');

      if (initialTeam1Players?.length || initialTeam2Players?.length) {
        setTeam1Players(initialTeam1Players || []);
        setTeam2Players(initialTeam2Players || []);
      } else {
        setTeam1Players([]);
        setTeam2Players([]);
      }

      supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            setError('Failed to load players.');
            setAvailablePlayers([]);
          } else {
            setAvailablePlayers(data || []);
          }
          setLoadingPlayers(false);
        });
    }
  }, [isOpen, initialTeam1Players, initialTeam2Players]);

  const getFilteredAvailablePlayers = (teamNumber: 1 | 2): Player[] => {
    const allSelectedIds = new Set([
      ...team1Players.map(p => p.id),
      ...team2Players.map(p => p.id),
    ]);
    return availablePlayers.filter(p => !allSelectedIds.has(p.id));
  };

  const handleAddPlayer = (teamNumber: 1 | 2) => {
    const selectedPlayerId = teamNumber === 1 ? selectedPlayerId1 : selectedPlayerId2;
    const currentTeamPlayers = teamNumber === 1 ? team1Players : team2Players;
    const setTeamPlayers = teamNumber === 1 ? setTeam1Players : setTeam2Players;
    const setSelectedPlayerId = teamNumber === 1 ? setSelectedPlayerId1 : setSelectedPlayerId2;

    if (!selectedPlayerId) return;
    if (currentTeamPlayers.length >= MAX_PLAYERS_PER_TEAM) {
      setError(`Maximum ${MAX_PLAYERS_PER_TEAM} players per team.`);
      return;
    }
    if ([...team1Players, ...team2Players].some(p => p.id === selectedPlayerId)) {
      setError('Player already added.');
      return;
    }

    const playerToAdd = availablePlayers.find(p => p.id === selectedPlayerId);
    if (playerToAdd) {
      setTeamPlayers([...currentTeamPlayers, playerToAdd]);
      setSelectedPlayerId('');
      setError(null);
    }
  };

  const handleRemovePlayer = (teamNumber: 1 | 2, playerId: string) => {
    const setTeamPlayers = teamNumber === 1 ? setTeam1Players : setTeam2Players;
    const currentPlayers = teamNumber === 1 ? team1Players : team2Players;
    setTeamPlayers(currentPlayers.filter(p => p.id !== playerId));
  };

  const handleSaveMatch = async (action: MatchSaveAction) => {
    if (!matchTeams) {
      setError('Cannot save match, teams not available.');
      return;
    }
    if (team1Players.length === 0 && team2Players.length === 0) {
      setError('Please add at least one player to the match.');
      return;
    }

    setSaving(true);
    setError(null);
    let newMatchId: string | null = null;

    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          team1_id: matchTeams[0].id,
          team2_id: matchTeams[1].id,
          team1_score: null,
          team2_score: null,
          penalties_winner: null,
          created_by: user?.id,
        })
        .select('id')
        .single();

      if (matchError || !matchData) throw new Error('Failed to save match details.');

      newMatchId = matchData.id;

      const playersToInsert = [
        ...team1Players.map(p => ({ match_id: newMatchId, player_id: p.id, team_number: 1 as const })),
        ...team2Players.map(p => ({ match_id: newMatchId, player_id: p.id, team_number: 2 as const })),
      ];

      if (playersToInsert.length > 0) {
        const { error: playersError } = await supabase
          .from('match_players')
          .insert(playersToInsert);

        if (playersError) throw new Error('Failed to save player assignments for the match.');
      }

      onMatchSaved({
        team1Id: matchTeams[0].id,
        team2Id: matchTeams[1].id,
        team1Players,
        team2Players,
        action,
      });

      onClose();
    } catch (err: any) {
      if (newMatchId) {
        await supabase.from('matches').delete().eq('id', newMatchId);
      }
      setError(err.message || 'An unexpected error occurred while saving.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl relative my-8">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close modal"
          disabled={saving}
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Match</h2>

        {!matchTeams ? (
          <p className="text-red-600">Error: Match teams not loaded.</p>
        ) : (
          <>
            {/* Team Display */}
            <div className="flex justify-around items-center mb-6 border-b pb-4">
              <div className="text-center">
                <TeamLogo team={matchTeams[0]} size="md" />
                <span className="font-semibold">{matchTeams[0].name}</span>
              </div>
              <span className="text-xl font-bold text-gray-500">VS</span>
              <div className="text-center">
                <TeamLogo team={matchTeams[1]} size="md" />
                <span className="font-semibold">{matchTeams[1].name}</span>
              </div>
            </div>

            {/* Player Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Team 1 Players */}
              <div>
                <h3 className="text-lg font-medium mb-2 text-gray-700">
                  {matchTeams[0].name} Players ({team1Players.length}/{MAX_PLAYERS_PER_TEAM})
                </h3>
                {loadingPlayers ? <p>Loading players...</p> : (
                  <div className="flex items-center space-x-2 mb-3">
                    <select
                      value={selectedPlayerId1}
                      onChange={(e) => setSelectedPlayerId1(e.target.value)}
                      className="grow px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm disabled:opacity-50"
                      disabled={team1Players.length >= MAX_PLAYERS_PER_TEAM || saving || getFilteredAvailablePlayers(1).length === 0}
                    >
                      <option value="">-- Select Player --</option>
                      {getFilteredAvailablePlayers(1).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAddPlayer(1)}
                      className="p-2 bg-brand-medium text-white rounded-md hover:bg-brand-dark disabled:opacity-50"
                      disabled={!selectedPlayerId1 || team1Players.length >= MAX_PLAYERS_PER_TEAM || saving}
                      aria-label="Add player to team 1"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                )}
                {!loadingPlayers && availablePlayers.length === 0 && (
                  <p className="text-xs text-red-500">No players found in the database.</p>
                )}
                <ul className="space-y-1 text-sm">
                  {team1Players.map(p => (
                    <li key={p.id} className="flex justify-between items-center bg-gray-100 px-2 py-1 rounded-sm">
                      <PlayerBadge player={p} size="xs" />
                      <button
                        onClick={() => handleRemovePlayer(1, p.id)}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        disabled={saving}
                        aria-label={`Remove ${p.name} from team 1`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Team 2 Players */}
              <div>
                <h3 className="text-lg font-medium mb-2 text-gray-700">
                  {matchTeams[1].name} Players ({team2Players.length}/{MAX_PLAYERS_PER_TEAM})
                </h3>
                {loadingPlayers ? <p>Loading players...</p> : (
                  <div className="flex items-center space-x-2 mb-3">
                    <select
                      value={selectedPlayerId2}
                      onChange={(e) => setSelectedPlayerId2(e.target.value)}
                      className="grow px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm disabled:opacity-50"
                      disabled={team2Players.length >= MAX_PLAYERS_PER_TEAM || saving || getFilteredAvailablePlayers(2).length === 0}
                    >
                      <option value="">-- Select Player --</option>
                      {getFilteredAvailablePlayers(2).map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleAddPlayer(2)}
                      className="p-2 bg-brand-medium text-white rounded-md hover:bg-brand-dark disabled:opacity-50"
                      disabled={!selectedPlayerId2 || team2Players.length >= MAX_PLAYERS_PER_TEAM || saving}
                      aria-label="Add player to team 2"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                )}
                {!loadingPlayers && availablePlayers.length === 0 && (
                  <p className="text-xs text-red-500">No players found in the database.</p>
                )}
                <ul className="space-y-1 text-sm">
                  {team2Players.map(p => (
                    <li key={p.id} className="flex justify-between items-center bg-gray-100 px-2 py-1 rounded-sm">
                      <PlayerBadge player={p} size="xs" />
                      <button
                        onClick={() => handleRemovePlayer(2, p.id)}
                        className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        disabled={saving}
                        aria-label={`Remove ${p.name} from team 2`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-sm text-red-600 mb-4 text-center">{error}</p>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 border-t pt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-hidden focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                onClick={() => handleSaveMatch('rematch')}
                className="flex items-center px-4 py-2 bg-brand-medium text-white rounded-md hover:bg-brand-dark focus:outline-hidden focus:ring-2 focus:ring-brand-medium disabled:opacity-50"
                disabled={saving || (team1Players.length === 0 && team2Players.length === 0)}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save & Rematch'}
              </button>
              <button
                onClick={() => handleSaveMatch('next')}
                className="flex items-center px-4 py-2 bg-brand-dark text-white rounded-md hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-brand-medium disabled:opacity-50"
                disabled={saving || (team1Players.length === 0 && team2Players.length === 0)}
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving...' : 'Save & Next'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddMatchModal;
