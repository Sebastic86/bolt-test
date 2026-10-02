import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { MatchHistoryItem, Player } from '../types';
import { TeamBadge } from './TeamBadge';
import { LoadingState, ErrorState, Select } from './ui';
import { useAuth } from '../contexts/AuthContext';
import {
  useAddPlayerToMatchMutation,
  useDeleteMatchMutation,
  useMoveMatchPlayerMutation,
  useUpdateMatchScoreMutation,
} from '../queries/matches';

interface MatchListProps {
  matches: MatchHistoryItem[];
  loading: boolean;
  error: string | null;
  /** All players — needed to offer "add an unlisted player to this match". */
  players: Player[];
  currentUserId?: string;
  /** Show the "(FC26)" version suffix next to team names — used on the All Matches page, not the Today's Matches section. */
  showTeamVersion?: boolean;
  emptyMessage?: string;
}

const formatDateTimeEuropean = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleString('en-GB', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
  } catch {
    return 'Invalid date';
  }
};

function useHighlightedMatchIds(matches: MatchHistoryItem[]): Set<string> {
  return useMemo(() => {
    const completed = matches.filter(m => m.team1_score !== null && m.team2_score !== null);
    if (completed.length === 0) return new Set();

    let maxDiff = -1;
    completed.forEach(m => {
      const diff = Math.abs(m.team1_score! - m.team2_score!);
      if (diff > maxDiff) maxDiff = diff;
    });
    const withMaxDiff = completed.filter(m => Math.abs(m.team1_score! - m.team2_score!) === maxDiff);
    if (withMaxDiff.length <= 1) return new Set(withMaxDiff.map(m => m.id));

    let maxGoals = -1;
    withMaxDiff.forEach(m => {
      const goals = m.team1_score! + m.team2_score!;
      if (goals > maxGoals) maxGoals = goals;
    });
    return new Set(withMaxDiff.filter(m => m.team1_score! + m.team2_score! === maxGoals).map(m => m.id));
  }, [matches]);
}

const MatchList: React.FC<MatchListProps> = ({
  matches,
  loading,
  error,
  players,
  currentUserId,
  showTeamVersion = false,
  emptyMessage = 'No matches recorded.',
}) => {
  const { isAdmin, isAuthenticated } = useAuth();
  const updateScore = useUpdateMatchScoreMutation();
  const deleteMatch = useDeleteMatchMutation();
  const movePlayer = useMoveMatchPlayerMutation();
  const addPlayer = useAddPlayerToMatchMutation();

  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [editingScoreMatchId, setEditingScoreMatchId] = useState<string | null>(null);
  const [score1Input, setScore1Input] = useState('');
  const [score2Input, setScore2Input] = useState('');
  const [penaltiesWinner, setPenaltiesWinner] = useState<1 | 2 | null>(null);
  const [editingPlayersMatchId, setEditingPlayersMatchId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  const highlightedMatchIds = useHighlightedMatchIds(matches);

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

  const handleSaveScore = (matchId: string) => {
    const s1 = parseInt(score1Input, 10);
    const s2 = parseInt(score2Input, 10);
    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      alert('Please enter valid non-negative scores.');
      return;
    }
    if (s1 === s2 && penaltiesWinner === null) {
      alert('For a draw, please select which team won on penalties.');
      return;
    }

    updateScore.mutate(
      { matchId, team1Score: s1, team2Score: s2, penaltiesWinner: s1 === s2 ? penaltiesWinner : null },
      {
        onSuccess: () => {
          setEditingScoreMatchId(null);
          setPenaltiesWinner(null);
        },
        onError: () => alert('Failed to save score.'),
      }
    );
  };

  const handleDelete = (match: MatchHistoryItem) => {
    const label = showTeamVersion
      ? `${match.team1_name} (${match.team1_version || 'FC26'}) vs ${match.team2_name} (${match.team2_version || 'FC26'})`
      : `${match.team1_name} vs ${match.team2_name}`;
    if (!window.confirm(`Are you sure you want to delete the match: ${label}? This action cannot be undone.`)) return;

    deleteMatch.mutate(match.id, { onError: () => alert('Failed to delete match.') });
  };

  const handleEditPlayersClick = (matchId: string) => {
    setEditingPlayersMatchId(matchId);
    setSelectedPlayerId('');
  };

  const handleCancelEditPlayers = () => {
    setEditingPlayersMatchId(null);
    setSelectedPlayerId('');
  };

  const handleMovePlayer = (matchId: string, playerId: string, newTeamNumber: 1 | 2) => {
    movePlayer.mutate(
      { matchId, playerId, newTeamNumber },
      { onError: () => alert('Failed to move player.') }
    );
  };

  const handleAddPlayer = (match: MatchHistoryItem, teamNumber: 1 | 2) => {
    if (!selectedPlayerId) {
      alert('Please select a player to add.');
      return;
    }
    addPlayer.mutate(
      { matchId: match.id, playerId: selectedPlayerId, teamNumber },
      {
        onSuccess: () => setSelectedPlayerId(''),
        onError: () => alert('Failed to add player to match.'),
      }
    );
  };

  const getAvailablePlayersForMatch = (match: MatchHistoryItem): Player[] => {
    const inMatch = new Set([...match.team1_players, ...match.team2_players].map(p => p.id));
    return players.filter(p => !inMatch.has(p.id));
  };

  const teamLabel = (name: string, version: string) => (showTeamVersion ? `${name} (${version || 'FC26'})` : name);

  if (loading && matches.length === 0) return <LoadingState label="Loading matches..." />;
  if (error) return <ErrorState message={error} />;
  if (matches.length === 0) return <p className="py-4 text-center text-sm text-gray-500">{emptyMessage}</p>;

  return (
    <div className="space-y-3">
      {matches.map(match => {
        const isHighlighted = highlightedMatchIds.has(match.id);
        const isOwner = !!(currentUserId && match.created_by === currentUserId);
        const canEditScore = isAuthenticated;
        const canDelete = isAdmin || isOwner;
        const isEditingScore = editingScoreMatchId === match.id;
        const isExpanded = expandedMatchId === match.id;
        const isDeleting = deleteMatch.isPending && deleteMatch.variables === match.id;

        return (
          <div
            key={match.id}
            className={`border-2 bg-white p-3 ${isHighlighted ? 'border-yellow-400 bg-yellow-50' : 'border-(--color-ink)'} ${isDeleting ? 'opacity-50' : ''}`}
          >
            <div className="mb-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-gray-400">
              {formatDateTimeEuropean(match.played_at)}
            </div>

            <div className="flex items-center gap-2 py-0.5">
              <TeamBadge name={match.team1_name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase text-(--color-ink)">
                {teamLabel(match.team1_name, match.team1_version)}
              </span>
              <span className="flex-none text-base font-black tabular-nums text-(--color-ink)">
                {match.team1_score ?? '-'}
              </span>
            </div>
            <div className="flex items-center gap-2 py-0.5">
              <TeamBadge name={match.team2_name} size="sm" />
              <span className="min-w-0 flex-1 truncate text-sm font-bold uppercase text-(--color-ink)">
                {teamLabel(match.team2_name, match.team2_version)}
              </span>
              <span className="flex-none text-base font-black tabular-nums text-(--color-ink)">
                {match.team2_score ?? '-'}
              </span>
            </div>
            {match.team1_score !== null && match.team1_score === match.team2_score && match.penalties_winner && (
              <div className="mt-1 text-[10px] text-gray-500">
                Pen: {match.penalties_winner === 1 ? teamLabel(match.team1_name, match.team1_version) : teamLabel(match.team2_name, match.team2_version)}
              </div>
            )}

            {isEditingScore && (
              <div className="mt-2 flex items-center justify-center gap-2 border-2 border-(--color-ink) bg-gray-50 p-2">
                <input
                  type="number" min="0" value={score1Input}
                  onChange={e => setScore1Input(e.target.value)}
                  className="h-9 w-11 border-2 border-(--color-ink) text-center text-base font-bold"
                  disabled={updateScore.isPending}
                />
                <span className="font-bold text-gray-400">-</span>
                <input
                  type="number" min="0" value={score2Input}
                  onChange={e => setScore2Input(e.target.value)}
                  className="h-9 w-11 border-2 border-(--color-ink) text-center text-base font-bold"
                  disabled={updateScore.isPending}
                />
                <button
                  onClick={() => handleSaveScore(match.id)}
                  disabled={updateScore.isPending}
                  className="flex h-9 w-9 flex-none items-center justify-center border-2 border-(--color-ink) bg-(--color-green-mid) text-white disabled:opacity-50"
                  aria-label="Save score"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCancelEditScore}
                  disabled={updateScore.isPending}
                  className="flex h-9 w-9 flex-none items-center justify-center border-2 border-(--color-ink) bg-white text-(--color-ink) disabled:opacity-50"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>

                {score1Input && score2Input && parseInt(score1Input, 10) === parseInt(score2Input, 10) && (
                  <div className="w-full pt-2 text-center text-xs">
                    <p className="mb-1 font-semibold text-gray-600">Penalties winner:</p>
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => setPenaltiesWinner(1)}
                        className={`border px-2 py-1 text-xs ${penaltiesWinner === 1 ? 'border-(--color-ink) bg-(--color-ink) text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                      >
                        {teamLabel(match.team1_name, match.team1_version)}
                      </button>
                      <button
                        onClick={() => setPenaltiesWinner(2)}
                        className={`border px-2 py-1 text-xs ${penaltiesWinner === 2 ? 'border-(--color-ink) bg-(--color-ink) text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                      >
                        {teamLabel(match.team2_name, match.team2_version)}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-2 border-t-2 border-(--color-ink) pt-2">
              {!isEditingScore && canEditScore && (
                <button
                  onClick={() => handleEditScoreClick(match)}
                  className="h-8 flex-1 border-2 border-(--color-ink) bg-(--color-ink) text-xs font-bold uppercase tracking-wide text-white"
                >
                  {match.team1_score !== null ? 'Edit Score' : 'Add Score'}
                </button>
              )}
              {isExpanded && canEditScore && editingPlayersMatchId !== match.id && (
                <button
                  onClick={() => handleEditPlayersClick(match.id)}
                  className="h-8 flex-1 border-2 border-(--color-ink) bg-white text-xs font-bold uppercase tracking-wide text-(--color-ink)"
                >
                  Edit Players
                </button>
              )}
              {editingPlayersMatchId === match.id && (
                <button
                  onClick={handleCancelEditPlayers}
                  className="flex h-8 flex-1 items-center justify-center gap-1 border-2 border-(--color-ink) bg-white text-xs font-bold uppercase tracking-wide text-(--color-ink)"
                >
                  <Save className="h-3.5 w-3.5" />
                  Done
                </button>
              )}
              <button
                onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                className="flex h-8 w-8 flex-none items-center justify-center border-2 border-(--color-ink) bg-white text-(--color-ink)"
                aria-label={isExpanded ? 'Collapse players' : 'Expand players'}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {canDelete && (
                <button
                  onClick={() => handleDelete(match)}
                  disabled={isDeleting}
                  className="flex h-8 w-8 flex-none items-center justify-center border-2 border-red-600 text-red-600 disabled:opacity-50"
                  aria-label="Delete match"
                >
                  {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>

            {isExpanded && (() => {
              const isEditingPlayers = editingPlayersMatchId === match.id;
              return (
                <div className="mt-2 grid grid-cols-2 gap-3 border-t-2 border-(--color-ink) pt-2 text-xs">
                  <div>
                    <strong className="mb-1 block font-black uppercase tracking-wide text-(--color-ink)">
                      {teamLabel(match.team1_name, match.team1_version)}
                    </strong>
                    {match.team1_players.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {match.team1_players.map(p => (
                          <span key={p.id} className="flex items-center gap-1 border border-(--color-ink) bg-gray-50 px-2 py-0.5">
                            {p.name}
                            {isEditingPlayers && (
                              <button
                                onClick={() => handleMovePlayer(match.id, p.id, 2)}
                                disabled={movePlayer.isPending}
                                className="text-(--color-ink) disabled:opacity-50"
                                aria-label={`Move ${p.name} to ${teamLabel(match.team2_name, match.team2_version)}`}
                              >
                                <ArrowRight className="h-3 w-3" />
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : <span className="italic text-gray-400">No players recorded</span>}
                  </div>
                  <div>
                    <strong className="mb-1 block font-black uppercase tracking-wide text-(--color-ink)">
                      {teamLabel(match.team2_name, match.team2_version)}
                    </strong>
                    {match.team2_players.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {match.team2_players.map(p => (
                          <span key={p.id} className="flex items-center gap-1 border border-(--color-ink) bg-gray-50 px-2 py-0.5">
                            {isEditingPlayers && (
                              <button
                                onClick={() => handleMovePlayer(match.id, p.id, 1)}
                                disabled={movePlayer.isPending}
                                className="text-(--color-ink) disabled:opacity-50"
                                aria-label={`Move ${p.name} to ${teamLabel(match.team1_name, match.team1_version)}`}
                              >
                                <ArrowLeft className="h-3 w-3" />
                              </button>
                            )}
                            {p.name}
                          </span>
                        ))}
                      </div>
                    ) : <span className="italic text-gray-400">No players recorded</span>}
                  </div>
                  {isEditingPlayers && (
                    <div className="col-span-2 flex flex-col gap-2 border-t border-dashed border-(--color-ink) pt-2">
                      <Select
                        value={selectedPlayerId}
                        onChange={e => setSelectedPlayerId(e.target.value)}
                        aria-label="Player to add to this match"
                      >
                        <option value="">Add a player…</option>
                        {getAvailablePlayersForMatch(match).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </Select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddPlayer(match, 1)}
                          disabled={!selectedPlayerId || addPlayer.isPending}
                          className="flex h-8 flex-1 items-center justify-center gap-1 border-2 border-(--color-ink) bg-white text-xs font-bold uppercase tracking-wide text-(--color-ink) disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          To {teamLabel(match.team1_name, match.team1_version)}
                        </button>
                        <button
                          onClick={() => handleAddPlayer(match, 2)}
                          disabled={!selectedPlayerId || addPlayer.isPending}
                          className="flex h-8 flex-1 items-center justify-center gap-1 border-2 border-(--color-ink) bg-white text-xs font-bold uppercase tracking-wide text-(--color-ink) disabled:opacity-50"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          To {teamLabel(match.team2_name, match.team2_version)}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
};

export default MatchList;
