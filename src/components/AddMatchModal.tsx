import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Team, Player } from '../types';
import { supabase } from '../lib/supabaseClient';
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
  }) => void; // Callback to trigger history refresh and next action
  initialTeam1Players?: Player[];
  initialTeam2Players?: Player[];
}

const MAX_PLAYERS_PER_TEAM = 4;
const MAX_ROUND_ROBIN_PLAYERS = 4;
const QUICK_SCORE_OPTIONS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [2, 1],
  [1, 2],
  [2, 0],
  [0, 2],
  [3, 2],
  [2, 3],
  [1, 1],
  [2, 2],
  [0, 0],
];

const AddMatchModal: React.FC<AddMatchModalProps> = ({
  isOpen,
  onClose,
  matchTeams,
  onMatchSaved,
  initialTeam1Players,
  initialTeam2Players,
}) => {
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [team1Players, setTeam1Players] = useState<Player[]>([]);
  const [team2Players, setTeam2Players] = useState<Player[]>([]);
  const [selectedPlayerId1, setSelectedPlayerId1] = useState<string>('');
  const [selectedPlayerId2, setSelectedPlayerId2] = useState<string>('');
  const [loadingPlayers, setLoadingPlayers] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [score1Input, setScore1Input] = useState<string>('');
  const [score2Input, setScore2Input] = useState<string>('');
  const [penaltiesWinner, setPenaltiesWinner] = useState<1 | 2 | null>(null);
  const [roundRobinPlayerIds, setRoundRobinPlayerIds] = useState<string[]>(
    Array(MAX_ROUND_ROBIN_PLAYERS).fill('')
  );
  const [roundRobinIndex, setRoundRobinIndex] = useState<number>(0);

  const playersById = useMemo(() => {
    return new Map(availablePlayers.map(player => [player.id, player]));
  }, [availablePlayers]);

  const roundRobinPlayers = useMemo(() => {
    return roundRobinPlayerIds.map(playerId => (playerId ? playersById.get(playerId) ?? null : null));
  }, [roundRobinPlayerIds, playersById]);

  const isRoundRobinReady = useMemo(() => {
    const hasAllPlayers = roundRobinPlayers.every(player => player !== null);
    if (!hasAllPlayers) return false;
    return new Set(roundRobinPlayerIds).size === MAX_ROUND_ROBIN_PLAYERS;
  }, [roundRobinPlayers, roundRobinPlayerIds]);

  const roundRobinPairings = useMemo(() => {
    if (!isRoundRobinReady) return [];

    const [player1, player2, player3, player4] = roundRobinPlayers as Player[];
    return [
      { team1: [player1, player2], team2: [player3, player4] },
      { team1: [player1, player3], team2: [player2, player4] },
      { team1: [player1, player4], team2: [player2, player3] },
    ];
  }, [isRoundRobinReady, roundRobinPlayers]);
  const maxPlayersPerTeam = isRoundRobinReady ? 2 : MAX_PLAYERS_PER_TEAM;

  const applyRoundRobinPairing = useCallback((index: number) => {
    const pairing = roundRobinPairings[index];
    if (!pairing) return;

    setTeam1Players(pairing.team1);
    setTeam2Players(pairing.team2);
    setSelectedPlayerId1('');
    setSelectedPlayerId2('');
    setError(null);
  }, [roundRobinPairings]);

  const handleRoundRobinPlayerChange = useCallback((slotIndex: number, playerId: string) => {
    setRoundRobinPlayerIds(prev => {
      const next = [...prev];
      next[slotIndex] = playerId;
      return next;
    });
  }, []);

  const handleUseRoundRobinPairing = useCallback(() => {
    if (!roundRobinPairings.length) return;
    applyRoundRobinPairing(roundRobinIndex);
  }, [applyRoundRobinPairing, roundRobinIndex, roundRobinPairings.length]);

  const handleNextRoundRobinPairing = useCallback(() => {
    if (!roundRobinPairings.length) return;
    const nextIndex = (roundRobinIndex + 1) % roundRobinPairings.length;
    setRoundRobinIndex(nextIndex);
    applyRoundRobinPairing(nextIndex);
  }, [applyRoundRobinPairing, roundRobinIndex, roundRobinPairings.length]);

  const handleResetRoundRobin = useCallback(() => {
    setRoundRobinPlayerIds(Array(MAX_ROUND_ROBIN_PLAYERS).fill(''));
    setRoundRobinIndex(0);
  }, []);
  // Fetch available players when modal opens
  useEffect(() => {
    if (isOpen) {
      console.log('[AddMatchModal] Modal opened, fetching players...'); // DEBUG
      setLoadingPlayers(true);
      setError(null);
      setSelectedPlayerId1('');
      setSelectedPlayerId2('');
      setScore1Input('');
      setScore2Input('');
      setPenaltiesWinner(null);

      if (initialTeam1Players?.length || initialTeam2Players?.length) {
        setTeam1Players(initialTeam1Players || []);
        setTeam2Players(initialTeam2Players || []);
      } else {
        setTeam1Players([]); // Reset selections
        setTeam2Players([]);
      }

      supabase
        .from('players')
        .select('*')
        .order('name', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            console.error('[AddMatchModal] Error fetching players:', error); // DEBUG
            setError('Failed to load players.');
            setAvailablePlayers([]);
          } else {
            console.log('[AddMatchModal] Players fetched successfully:', data); // DEBUG
            setAvailablePlayers(data || []);
          }
          setLoadingPlayers(false);
        });
    } else {
        console.log('[AddMatchModal] Modal closed.'); // DEBUG
    }
  }, [isOpen, initialTeam1Players, initialTeam2Players]);

  useEffect(() => {
    setRoundRobinIndex(0);
  }, [roundRobinPlayerIds.join('|')]);

  useEffect(() => {
    if (!isOpen || !isRoundRobinReady || roundRobinPairings.length === 0) return;
    if (initialTeam1Players?.length || initialTeam2Players?.length) return;
    if (team1Players.length > 0 || team2Players.length > 0) return;

    applyRoundRobinPairing(roundRobinIndex);
  }, [
    isOpen,
    isRoundRobinReady,
    roundRobinPairings.length,
    roundRobinIndex,
    team1Players.length,
    team2Players.length,
    initialTeam1Players,
    initialTeam2Players,
    applyRoundRobinPairing,
  ]);

  // Log state changes for debugging
  useEffect(() => {
    console.log('[AddMatchModal] Available players state updated:', availablePlayers);
  }, [availablePlayers]);


  const handleAddPlayer = (teamNumber: 1 | 2) => {
    const selectedPlayerId = teamNumber === 1 ? selectedPlayerId1 : selectedPlayerId2;
    const currentTeamPlayers = teamNumber === 1 ? team1Players : team2Players;
    const setTeamPlayers = teamNumber === 1 ? setTeam1Players : setTeam2Players;
    const setSelectedPlayerId = teamNumber === 1 ? setSelectedPlayerId1 : setSelectedPlayerId2;

    if (!selectedPlayerId) return;
    if (currentTeamPlayers.length >= maxPlayersPerTeam) {
        setError(isRoundRobinReady
          ? 'Round robin mode supports 2 players per team.'
          : `Maximum ${MAX_PLAYERS_PER_TEAM} players per team.`);
        return;
    }
    if (currentTeamPlayers.some(p => p.id === selectedPlayerId)) {
        setError('Player already added to this team.');
        return;
    }
     const otherTeamPlayers = teamNumber === 1 ? team2Players : team1Players;
     if (otherTeamPlayers.some(p => p.id === selectedPlayerId)) {
         setError('Player already selected for the other team.');
         return;
     }

    const playerToAdd = availablePlayers.find(p => p.id === selectedPlayerId);
    if (playerToAdd) {
      console.log(`[AddMatchModal] Adding player ${playerToAdd.name} to team ${teamNumber}`); // DEBUG
      setTeamPlayers([...currentTeamPlayers, playerToAdd]);
      setSelectedPlayerId('');
      setError(null);
    } else {
        console.warn(`[AddMatchModal] Could not find player with ID ${selectedPlayerId} in available players.`); // DEBUG
    }
  };

  const handleRemovePlayer = (teamNumber: 1 | 2, playerId: string) => {
    const currentTeamPlayers = teamNumber === 1 ? team1Players : team2Players;
    const setTeamPlayers = teamNumber === 1 ? setTeam1Players : setTeam2Players;
    console.log(`[AddMatchModal] Removing player ${playerId} from team ${teamNumber}`); // DEBUG
    setTeamPlayers(currentTeamPlayers.filter(p => p.id !== playerId));
  };

  const handleScoreChange = (teamNumber: 1 | 2, value: string) => {
    const trimmedValue = value.replace(/[^\d]/g, '');
    if (teamNumber === 1) {
      setScore1Input(trimmedValue);
    } else {
      setScore2Input(trimmedValue);
    }

    const nextScore1 = teamNumber === 1 ? trimmedValue : score1Input;
    const nextScore2 = teamNumber === 2 ? trimmedValue : score2Input;
    if (nextScore1 !== '' && nextScore2 !== '') {
      const parsed1 = parseInt(nextScore1, 10);
      const parsed2 = parseInt(nextScore2, 10);
      if (!Number.isNaN(parsed1) && !Number.isNaN(parsed2) && parsed1 !== parsed2) {
        setPenaltiesWinner(null);
      }
    } else {
      setPenaltiesWinner(null);
    }
  };

  const handleQuickScoreSelect = (score1: number, score2: number) => {
    setScore1Input(score1.toString());
    setScore2Input(score2.toString());
    setPenaltiesWinner(null);
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

    const trimmedScore1 = score1Input.trim();
    const trimmedScore2 = score2Input.trim();
    const score1 = trimmedScore1 === '' ? null : parseInt(trimmedScore1, 10);
    const score2 = trimmedScore2 === '' ? null : parseInt(trimmedScore2, 10);
    const hasScores = score1 !== null && score2 !== null;

    if ((score1 === null) !== (score2 === null)) {
      setError('Please enter both scores or leave both empty.');
      return;
    }
    if (hasScores && (Number.isNaN(score1) || Number.isNaN(score2) || score1 < 0 || score2 < 0)) {
      setError('Please enter valid non-negative scores.');
      return;
    }
    if (hasScores && score1 === score2 && penaltiesWinner === null) {
      setError('For a draw, please select which team won on penalties.');
      return;
    }

    const finalPenaltiesWinner = hasScores && score1 === score2 ? penaltiesWinner : null;

    setSaving(true);
    setError(null);
    console.log('[AddMatchModal] Saving match...'); // DEBUG

    let newMatchId: string | null = null;

    try {
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          team1_id: matchTeams[0].id,
          team2_id: matchTeams[1].id,
          team1_score: score1,
          team2_score: score2,
          penalties_winner: finalPenaltiesWinner,
        })
        .select('id')
        .single();

      if (matchError || !matchData) {
        console.error('[AddMatchModal] Error inserting match:', matchError);
        throw new Error('Failed to save match details.');
      }

      newMatchId = matchData.id;
      console.log(`[AddMatchModal] Match inserted with ID: ${newMatchId}`); // DEBUG

      const playersToInsert = [
        ...team1Players.map(p => ({ match_id: newMatchId, player_id: p.id, team_number: 1 as const })),
        ...team2Players.map(p => ({ match_id: newMatchId, player_id: p.id, team_number: 2 as const })),
      ];

      if (playersToInsert.length > 0) {
        console.log('[AddMatchModal] Inserting match players:', playersToInsert); // DEBUG
        const { error: playersError } = await supabase
          .from('match_players')
          .insert(playersToInsert);

        if (playersError) {
          console.error('[AddMatchModal] Error inserting match players:', playersError);
          throw new Error('Failed to save player assignments for the match.');
        }
      }

      console.log('[AddMatchModal] Match saved successfully!');
      onMatchSaved({
        team1Id: matchTeams[0].id,
        team2Id: matchTeams[1].id,
        team1Players,
        team2Players,
        action,
      });

      if (action === 'next' && shouldAdvanceRoundRobin && roundRobinPairings.length > 0) {
        setRoundRobinIndex((roundRobinIndex + 1) % roundRobinPairings.length);
      }

      setScore1Input('');
      setScore2Input('');
      setPenaltiesWinner(null);
      onClose();

    } catch (err: any) {
      if (newMatchId) {
        const { error: cleanupError } = await supabase
          .from('matches')
          .delete()
          .eq('id', newMatchId);

        if (cleanupError) {
          console.error('[AddMatchModal] Cleanup failed for match:', cleanupError);
        }
      }

      setError(err.message || 'An unexpected error occurred while saving.');
      console.error('[AddMatchModal] Save match error:', err); // DEBUG
    } finally {
      setSaving(false);
    }
  };

  // Filter available players for dropdowns
  const getFilteredAvailablePlayers = (teamNumber: 1 | 2): Player[] => {
    const selectedOnThisTeam = (teamNumber === 1 ? team1Players : team2Players).map(p => p.id);
    const selectedOnOtherTeam = (teamNumber === 1 ? team2Players : team1Players).map(p => p.id);
    const allSelectedIds = new Set([...selectedOnThisTeam, ...selectedOnOtherTeam]);
    const filtered = availablePlayers.filter(p => !allSelectedIds.has(p.id));
    // console.log(`[AddMatchModal] Filtering available players for team ${teamNumber}. All: ${availablePlayers.length}, Selected IDs: ${[...allSelectedIds]}, Filtered: ${filtered.length}`); // DEBUG (can be noisy)
    return filtered;
  };

  const currentRoundRobinPairing = roundRobinPairings[roundRobinIndex];
  const parsedScore1 = score1Input === '' ? null : parseInt(score1Input, 10);
  const parsedScore2 = score2Input === '' ? null : parseInt(score2Input, 10);
  const showPenaltySelector =
    parsedScore1 !== null &&
    parsedScore2 !== null &&
    !Number.isNaN(parsedScore1) &&
    !Number.isNaN(parsedScore2) &&
    parsedScore1 === parsedScore2;
  const doesTeamMatchPairing = (teamPlayers: Player[], pairingPlayers: Player[]) => {
    if (teamPlayers.length !== pairingPlayers.length) return false;
    const teamIds = new Set(teamPlayers.map(player => player.id));
    return pairingPlayers.every(player => teamIds.has(player.id));
  };
  const shouldAdvanceRoundRobin =
    isRoundRobinReady &&
    currentRoundRobinPairing &&
    ((doesTeamMatchPairing(team1Players, currentRoundRobinPairing.team1) &&
      doesTeamMatchPairing(team2Players, currentRoundRobinPairing.team2)) ||
      (doesTeamMatchPairing(team1Players, currentRoundRobinPairing.team2) &&
        doesTeamMatchPairing(team2Players, currentRoundRobinPairing.team1)));


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

        <h2 className="text-xl font-semibold mb-4 text-gray-800">Add Match Details</h2>

        {!matchTeams ? (
          <p className="text-red-600">Error: Match teams not loaded.</p>
        ) : (
          <>
            {/* Team Display */}
            <div className="flex justify-around items-center mb-6 border-b pb-4">
              {/* ... team display ... */}
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

            {/* Round Robin Scheduler */}
            <div className="mb-6 border-b pb-4">
              <h3 className="text-lg font-medium mb-1 text-gray-700">4-Player Round Robin (2v2)</h3>
              <p className="text-xs text-gray-500 mb-3">
                Select exactly 4 players to rotate balanced pairings before repeats.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roundRobinPlayerIds.map((playerId, slotIndex) => {
                  const otherSelectedIds = new Set(
                    roundRobinPlayerIds
                      .filter((id, index) => index !== slotIndex && id)
                  );
                  const options = availablePlayers.filter(p => !otherSelectedIds.has(p.id));

                  return (
                    <select
                      key={`rr-${slotIndex}`}
                      value={playerId}
                      onChange={(e) => handleRoundRobinPlayerChange(slotIndex, e.target.value)}
                      className="px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm disabled:opacity-50"
                      disabled={loadingPlayers || saving}
                    >
                      <option value="">{`-- Select Player ${slotIndex + 1} --`}</option>
                      {options.map(player => (
                        <option key={player.id} value={player.id}>{player.name}</option>
                      ))}
                    </select>
                  );
                })}
              </div>

              {!isRoundRobinReady && (
                <p className="text-xs text-gray-500 mt-2">Pick 4 unique players to enable pairings.</p>
              )}

              {isRoundRobinReady && currentRoundRobinPairing && (
                <div className="mt-3 rounded-md bg-brand-lighter border border-brand-light p-3">
                  <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                    <span>Round {roundRobinIndex + 1} of {roundRobinPairings.length}</span>
                    <span>Pairings rotate before repeats</span>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-gray-700">
                    <span className="font-medium">
                      {currentRoundRobinPairing.team1[0].name} + {currentRoundRobinPairing.team1[1].name}
                    </span>
                    <span className="text-gray-400">vs</span>
                    <span className="font-medium">
                      {currentRoundRobinPairing.team2[0].name} + {currentRoundRobinPairing.team2[1].name}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Round robin mode limits teams to 2 players per side.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <button
                      onClick={handleUseRoundRobinPairing}
                      className="px-3 py-1.5 bg-brand-medium text-white rounded-md hover:bg-brand-dark disabled:opacity-50 text-xs sm:text-sm"
                      disabled={saving}
                    >
                      Use Pairing
                    </button>
                    <button
                      onClick={handleNextRoundRobinPairing}
                      className="px-3 py-1.5 bg-white text-brand-dark border border-brand-medium rounded-md hover:bg-brand-lighter disabled:opacity-50 text-xs sm:text-sm"
                      disabled={saving}
                    >
                      Next Pairing
                    </button>
                    <button
                      onClick={handleResetRoundRobin}
                      className="px-3 py-1.5 bg-gray-100 text-gray-600 border border-gray-200 rounded-md hover:bg-gray-200 disabled:opacity-50 text-xs sm:text-sm"
                      disabled={saving}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Player Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {/* Team 1 Players */}
              <div>
                <h3 className="text-lg font-medium mb-2 text-gray-700">{matchTeams[0].name} Players ({team1Players.length}/{maxPlayersPerTeam})</h3>
                {loadingPlayers ? <p>Loading players...</p> : (
                  <div className="flex items-center space-x-2 mb-3">
                    <select
                      value={selectedPlayerId1}
                      onChange={(e) => setSelectedPlayerId1(e.target.value)}
                      className="grow px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm disabled:opacity-50"
                      disabled={team1Players.length >= maxPlayersPerTeam || saving || getFilteredAvailablePlayers(1).length === 0}
                    >
                      <option value="">-- Select Player --</option>
                      {getFilteredAvailablePlayers(1).map(p => {
                        // console.log(`[AddMatchModal] Rendering option for Team 1: ${p.name} (${p.id})`); // DEBUG (can be noisy)
                        return <option key={p.id} value={p.id}>{p.name}</option>;
                      })}
                    </select>
                    <button
                      onClick={() => handleAddPlayer(1)}
                      className="p-2 bg-brand-medium text-white rounded-md hover:bg-brand-dark disabled:opacity-50"
                      disabled={!selectedPlayerId1 || team1Players.length >= maxPlayersPerTeam || saving}
                      aria-label="Add player to team 1"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                )}
                 {/* Add message if no players available */}
                 {!loadingPlayers && getFilteredAvailablePlayers(1).length === 0 && availablePlayers.length > 0 && (
                    <p className="text-xs text-gray-500">No more players available to add.</p>
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
                        className="text-red-500 hover:text-red-700 disabled:opacity-50" // Keep remove red
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
                <h3 className="text-lg font-medium mb-2 text-gray-700">{matchTeams[1].name} Players ({team2Players.length}/{maxPlayersPerTeam})</h3>
                 {loadingPlayers ? <p>Loading players...</p> : (
                  <div className="flex items-center space-x-2 mb-3">
                    <select
                      value={selectedPlayerId2}
                      onChange={(e) => setSelectedPlayerId2(e.target.value)}
                      className="grow px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm disabled:opacity-50"
                      disabled={team2Players.length >= maxPlayersPerTeam || saving || getFilteredAvailablePlayers(2).length === 0}
                    >
                      <option value="">-- Select Player --</option>
                       {getFilteredAvailablePlayers(2).map(p => {
                        // console.log(`[AddMatchModal] Rendering option for Team 2: ${p.name} (${p.id})`); // DEBUG (can be noisy)
                        return <option key={p.id} value={p.id}>{p.name}</option>;
                       })}
                    </select>
                    <button
                      onClick={() => handleAddPlayer(2)}
                      className="p-2 bg-brand-medium text-white rounded-md hover:bg-brand-dark disabled:opacity-50"
                      disabled={!selectedPlayerId2 || team2Players.length >= maxPlayersPerTeam || saving}
                       aria-label="Add player to team 2"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                 )}
                  {/* Add message if no players available */}
                 {!loadingPlayers && getFilteredAvailablePlayers(2).length === 0 && availablePlayers.length > 0 && (
                    <p className="text-xs text-gray-500">No more players available to add.</p>
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
                        className="text-red-500 hover:text-red-700 disabled:opacity-50" // Keep remove red
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

            {/* Quick Score Entry */}
            <div className="mb-6 border-t pt-4">
              <h3 className="text-lg font-medium mb-1 text-gray-700">Quick Score</h3>
              <p className="text-xs text-gray-500 mb-3">Tap a score or enter one manually.</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {QUICK_SCORE_OPTIONS.map(([score1, score2]) => {
                  const isSelected = parsedScore1 === score1 && parsedScore2 === score2;
                  return (
                    <button
                      key={`${score1}-${score2}`}
                      onClick={() => handleQuickScoreSelect(score1, score2)}
                      className={`px-3 py-1.5 rounded-md text-xs sm:text-sm border ${
                        isSelected
                          ? 'bg-brand-medium text-white border-brand-medium'
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-brand-lighter'
                      }`}
                      disabled={saving}
                    >
                      {score1} - {score2}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={score1Input}
                  onChange={(e) => handleScoreChange(1, e.target.value)}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center"
                  min="0"
                  disabled={saving}
                />
                <span className="text-gray-500 font-medium">-</span>
                <input
                  type="number"
                  value={score2Input}
                  onChange={(e) => handleScoreChange(2, e.target.value)}
                  className="w-20 px-2 py-1 border border-gray-300 rounded-md text-center"
                  min="0"
                  disabled={saving}
                />
              </div>
              {showPenaltySelector && (
                <div className="mt-3 text-xs">
                  <p className="font-medium text-gray-600 mb-1">Penalties winner:</p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setPenaltiesWinner(1)}
                      className={`px-3 py-1 rounded-sm ${
                        penaltiesWinner === 1
                          ? 'bg-brand-medium text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      disabled={saving}
                    >
                      {matchTeams[0].name}
                    </button>
                    <button
                      onClick={() => setPenaltiesWinner(2)}
                      className={`px-3 py-1 rounded-sm ${
                        penaltiesWinner === 2
                          ? 'bg-brand-medium text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      disabled={saving}
                    >
                      {matchTeams[1].name}
                    </button>
                  </div>
                </div>
              )}
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
