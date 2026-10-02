import React, { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { MatchHistoryItem, Player } from '../types';
import { TeamLogo } from './TeamLogo';
import { PlayerBadge } from './PlayerBadge';
import { LoadingState, ErrorState, Select, useToast } from './ui';
import { useAuth } from '../contexts/AuthContext';
import {
  useAddPlayerToMatchMutation,
  useDeleteMatchMutation,
  useMoveMatchPlayerMutation,
  useUpdateMatchScoreMutation,
} from '../queries/matches';
import {
  formatDateTimeEuropean,
  formatTimeEuropean,
  getHighlightedMatchIds,
  getMatchResultForSide,
  getPerspectiveSide,
  MatchPerspective,
  MatchResult,
} from '../utils/matchDisplay';

interface MatchListProps {
  matches: MatchHistoryItem[];
  loading: boolean;
  error: string | null;
  /** All players — needed to offer "add an unlisted player to this match". */
  players: Player[];
  currentUserId?: string;
  /** Show the "(FC27)" version suffix next to team names — used on the All Matches page, not the Today's Matches section. */
  showTeamVersion?: boolean;
  emptyMessage?: string;
  /**
   * Show each match from one team's/player's point of view: a Win / Loss /
   * Win (P) / Loss (P) badge per match, the selected team's row marked and
   * the selected player highlighted. Used by MatchDetailsSheet.
   */
  perspective?: MatchPerspective | null;
  /** Gold-highlight the biggest win in this list ("match of the day"). Default true. */
  highlightBiggestWin?: boolean;
  /** Show only HH:mm instead of the full date (lists that are already a single day, e.g. a game session). */
  timeOnly?: boolean;
  /** Always show each side's players under the team name. Defaults to on when a perspective is set. */
  showPlayersInline?: boolean;
}

const BUTTON_BASE = 'flex h-10 items-center justify-center border-2 border-(--color-ink) text-xs font-bold uppercase tracking-wide disabled:opacity-50';

/** Crest data for list rows — deliberately no id/apiTeamId/apiTeamName, so a long list never triggers logo API lookups (see TeamLogo). */
const listCrest = (name: string, resolvedLogoUrl: string | null | undefined, logoUrl: string) => ({ name, resolvedLogoUrl, logoUrl });

const RESULT_STYLES: Record<MatchResult, string> = {
  Win: 'border-(--color-green-mid) bg-(--color-green-mid) text-white',
  'Win (P)': 'border-(--color-green-mid) bg-white text-(--color-green-mid)',
  Loss: 'border-red-600 bg-red-600 text-white',
  'Loss (P)': 'border-red-600 bg-white text-red-600',
  Draw: 'border-gray-400 bg-white text-gray-600',
  'No Score': 'border-gray-300 bg-white text-gray-400',
};

const ResultBadge: React.FC<{ result: MatchResult }> = ({ result }) => (
  <span className={`flex-none border-2 px-1.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-wide ${RESULT_STYLES[result]}`}>
    {result}
  </span>
);

const PlayerChip: React.FC<{ player: Player; highlighted: boolean; size?: 'xs' | 'sm' }> = ({ player, highlighted, size = 'xs' }) => (
  <span
    className={`inline-flex min-w-0 max-w-full items-center ${highlighted ? 'bg-green-100 px-1 ring-2 ring-(--color-green-mid)' : ''}`}
  >
    <PlayerBadge player={player} size={size} />
    {highlighted && <span className="sr-only"> (selected player)</span>}
  </span>
);

const MatchList: React.FC<MatchListProps> = ({
  matches,
  loading,
  error,
  players,
  currentUserId,
  showTeamVersion = false,
  emptyMessage = 'No matches recorded.',
  perspective = null,
  highlightBiggestWin = true,
  timeOnly = false,
  showPlayersInline,
}) => {
  const { isAdmin, isAuthenticated } = useAuth();
  const updateScore = useUpdateMatchScoreMutation();
  const deleteMatch = useDeleteMatchMutation();
  const movePlayer = useMoveMatchPlayerMutation();
  const addPlayer = useAddPlayerToMatchMutation();
  const { toast } = useToast();
  const showError = (title: string) => toast({ title, variant: 'error' });

  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [editingScoreMatchId, setEditingScoreMatchId] = useState<string | null>(null);
  const [score1Input, setScore1Input] = useState('');
  const [score2Input, setScore2Input] = useState('');
  const [penaltiesWinner, setPenaltiesWinner] = useState<1 | 2 | null>(null);
  const [editingPlayersMatchId, setEditingPlayersMatchId] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  const highlightedMatchIds = useMemo(
    () => (highlightBiggestWin ? getHighlightedMatchIds(matches) : new Set<string>()),
    [matches, highlightBiggestWin]
  );
  const playersInline = showPlayersInline ?? perspective !== null;
  const highlightPlayerId = perspective?.kind === 'player' ? perspective.playerId : null;

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
      showError('Please enter valid non-negative scores.');
      return;
    }
    if (s1 === s2 && penaltiesWinner === null) {
      showError('For a draw, please select which team won on penalties.');
      return;
    }

    updateScore.mutate(
      { matchId, team1Score: s1, team2Score: s2, penaltiesWinner: s1 === s2 ? penaltiesWinner : null },
      {
        onSuccess: () => {
          setEditingScoreMatchId(null);
          setPenaltiesWinner(null);
        },
        onError: () => showError('Failed to save score.'),
      }
    );
  };

  const handleDelete = (match: MatchHistoryItem) => {
    const label = `${teamLabel(match.team1_name, match.team1_version)} vs ${teamLabel(match.team2_name, match.team2_version)}`;
    if (!window.confirm(`Are you sure you want to delete the match: ${label}? This action cannot be undone.`)) return;

    deleteMatch.mutate(match.id, { onError: () => showError('Failed to delete match.') });
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
      { onError: () => showError('Failed to move player.') }
    );
  };

  const handleAddPlayer = (match: MatchHistoryItem, teamNumber: 1 | 2) => {
    if (!selectedPlayerId) {
      showError('Please select a player to add.');
      return;
    }
    addPlayer.mutate(
      { matchId: match.id, playerId: selectedPlayerId, teamNumber },
      {
        onSuccess: () => setSelectedPlayerId(''),
        onError: () => showError('Failed to add player to match.'),
      }
    );
  };

  const getAvailablePlayersForMatch = (match: MatchHistoryItem): Player[] => {
    const inMatch = new Set([...match.team1_players, ...match.team2_players].map(p => p.id));
    return players.filter(p => !inMatch.has(p.id));
  };

  function teamLabel(name: string, version: string) {
    return showTeamVersion && version ? `${name} (${version})` : name;
  }

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
        const isEditingPlayers = editingPlayersMatchId === match.id;
        const isDeleting = deleteMatch.isPending && deleteMatch.variables === match.id;
        const perspectiveSide = perspective ? getPerspectiveSide(match, perspective) : null;
        const result = perspectiveSide ? getMatchResultForSide(match, perspectiveSide) : null;
        const markedSide = perspective?.kind === 'team' ? perspectiveSide : null;

        const sides = [
          {
            side: 1 as const,
            label: teamLabel(match.team1_name, match.team1_version),
            crest: listCrest(match.team1_name, match.team1_resolvedLogoUrl, match.team1_logoUrl),
            score: match.team1_score,
            players: match.team1_players,
          },
          {
            side: 2 as const,
            label: teamLabel(match.team2_name, match.team2_version),
            crest: listCrest(match.team2_name, match.team2_resolvedLogoUrl, match.team2_logoUrl),
            score: match.team2_score,
            players: match.team2_players,
          },
        ];

        return (
          <div
            key={match.id}
            className={`border-2 p-3 ${isHighlighted ? 'border-yellow-400 bg-yellow-50' : 'border-(--color-ink) bg-white'} ${isDeleting ? 'opacity-50' : ''}`}
          >
            <div className="mb-1.5 flex min-h-5 items-center gap-1.5">
              {result && <ResultBadge result={result} />}
              {isHighlighted && (
                <span className="flex-none bg-yellow-400 px-1.5 py-0.5 text-[10px] font-black uppercase leading-none tracking-wide text-(--color-ink)">
                  Biggest win
                </span>
              )}
              <span className="ml-auto text-[10px] font-bold uppercase tracking-wide text-gray-400">
                {timeOnly ? formatTimeEuropean(match.played_at) : formatDateTimeEuropean(match.played_at)}
              </span>
            </div>

            {sides.map(s => (
              <div
                key={s.side}
                className={`flex items-center gap-2 py-0.5 ${markedSide === s.side ? '-ml-1.5 border-l-4 border-(--color-green-mid) pl-0.5' : ''}`}
              >
                <TeamLogo team={s.crest} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold uppercase text-(--color-ink)">{s.label}</div>
                  {playersInline && s.players.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1">
                      {s.players.map(p => (
                        <PlayerChip key={p.id} player={p} highlighted={p.id === highlightPlayerId} />
                      ))}
                    </div>
                  )}
                </div>
                <span className={`flex-none text-base font-black tabular-nums ${isHighlighted ? 'text-yellow-700' : 'text-(--color-ink)'}`}>
                  {s.score ?? '-'}
                </span>
              </div>
            ))}
            {match.team1_score !== null && match.team1_score === match.team2_score && match.penalties_winner && (
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                Won on penalties: {match.penalties_winner === 1 ? sides[0].label : sides[1].label}
              </div>
            )}

            {isEditingScore && (
              <div className="mt-2 flex flex-wrap items-center justify-center gap-2 border-2 border-(--color-ink) bg-gray-50 p-2">
                <input
                  type="number" inputMode="numeric" min="0" value={score1Input}
                  onChange={e => setScore1Input(e.target.value)}
                  className="h-10 w-12 border-2 border-(--color-ink) text-center text-base font-bold"
                  disabled={updateScore.isPending}
                  aria-label={`${sides[0].label} score`}
                />
                <span className="font-bold text-gray-400">-</span>
                <input
                  type="number" inputMode="numeric" min="0" value={score2Input}
                  onChange={e => setScore2Input(e.target.value)}
                  className="h-10 w-12 border-2 border-(--color-ink) text-center text-base font-bold"
                  disabled={updateScore.isPending}
                  aria-label={`${sides[1].label} score`}
                />
                <button
                  onClick={() => handleSaveScore(match.id)}
                  disabled={updateScore.isPending}
                  className="flex h-10 w-10 flex-none items-center justify-center border-2 border-(--color-ink) bg-(--color-green-mid) text-white disabled:opacity-50"
                  aria-label="Save score"
                >
                  <Save className="h-4 w-4" />
                </button>
                <button
                  onClick={handleCancelEditScore}
                  disabled={updateScore.isPending}
                  className="flex h-10 w-10 flex-none items-center justify-center border-2 border-(--color-ink) bg-white text-(--color-ink) disabled:opacity-50"
                  aria-label="Cancel"
                >
                  <X className="h-4 w-4" />
                </button>

                {score1Input && score2Input && parseInt(score1Input, 10) === parseInt(score2Input, 10) && (
                  <div className="w-full pt-1 text-center text-xs">
                    <p className="mb-1 font-bold uppercase tracking-wide text-gray-600">Penalties winner</p>
                    <div className="flex gap-2">
                      {sides.map(s => (
                        <button
                          key={s.side}
                          onClick={() => setPenaltiesWinner(s.side)}
                          aria-pressed={penaltiesWinner === s.side}
                          className={`h-10 min-w-0 flex-1 truncate border-2 px-2 text-xs font-bold ${penaltiesWinner === s.side ? 'border-(--color-ink) bg-(--color-ink) text-white' : 'border-gray-300 bg-white text-gray-700'}`}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 flex items-center gap-2 border-t-2 border-(--color-ink) pt-2">
              {!isEditingScore && canEditScore && (
                <button
                  onClick={() => handleEditScoreClick(match)}
                  className={`${BUTTON_BASE} flex-1 bg-(--color-ink) text-white`}
                >
                  {match.team1_score !== null ? 'Edit Score' : 'Add Score'}
                </button>
              )}
              {isExpanded && canEditScore && !isEditingPlayers && (
                <button
                  onClick={() => handleEditPlayersClick(match.id)}
                  className={`${BUTTON_BASE} flex-1 bg-white text-(--color-ink)`}
                >
                  Edit Players
                </button>
              )}
              {isEditingPlayers && (
                <button
                  onClick={handleCancelEditPlayers}
                  className={`${BUTTON_BASE} flex-1 gap-1 bg-white text-(--color-ink)`}
                >
                  <Save className="h-3.5 w-3.5" />
                  Done
                </button>
              )}
              <button
                onClick={() => setExpandedMatchId(isExpanded ? null : match.id)}
                className="ml-auto flex h-10 w-10 flex-none items-center justify-center border-2 border-(--color-ink) bg-white text-(--color-ink)"
                aria-label={isExpanded ? 'Collapse players' : 'Expand players'}
                aria-expanded={isExpanded}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>
              {canDelete && (
                <button
                  onClick={() => handleDelete(match)}
                  disabled={isDeleting}
                  className="flex h-10 w-10 flex-none items-center justify-center border-2 border-red-600 bg-white text-red-600 disabled:opacity-50"
                  aria-label="Delete match"
                >
                  {isDeleting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </div>

            {isExpanded && (
              <div className="mt-2 grid grid-cols-2 gap-3 border-t-2 border-(--color-ink) pt-2 text-xs">
                {sides.map(s => {
                  const otherSide = s.side === 1 ? sides[1] : sides[0];
                  const MoveIcon = s.side === 1 ? ArrowRight : ArrowLeft;
                  return (
                    <div key={s.side} className="min-w-0">
                      <strong className="mb-1 block truncate font-black uppercase tracking-wide text-(--color-ink)">
                        {s.label}
                      </strong>
                      {s.players.length > 0 ? (
                        <ul className="space-y-1">
                          {s.players.map(p => (
                            <li key={p.id} className={`flex min-w-0 items-center gap-1 ${s.side === 2 && isEditingPlayers ? 'flex-row-reverse justify-end' : ''}`}>
                              <span className="min-w-0 flex-1">
                                <PlayerChip player={p} highlighted={p.id === highlightPlayerId} size="sm" />
                              </span>
                              {isEditingPlayers && (
                                <button
                                  onClick={() => handleMovePlayer(match.id, p.id, otherSide.side)}
                                  disabled={movePlayer.isPending}
                                  className="flex h-10 w-10 flex-none items-center justify-center border-2 border-(--color-ink) bg-white text-(--color-ink) disabled:opacity-50"
                                  aria-label={`Move ${p.name} to ${otherSide.label}`}
                                >
                                  <MoveIcon className="h-4 w-4" />
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : <span className="italic text-gray-400">No players recorded</span>}
                    </div>
                  );
                })}
                {isEditingPlayers && (() => {
                  const available = getAvailablePlayersForMatch(match);
                  if (available.length === 0) {
                    return (
                      <p className="col-span-2 border-t border-dashed border-(--color-ink) pt-2 text-center italic text-gray-500">
                        All players are already in this match.
                      </p>
                    );
                  }
                  return (
                    <div className="col-span-2 flex flex-col gap-2 border-t border-dashed border-(--color-ink) pt-2">
                      <Select
                        value={selectedPlayerId}
                        onChange={e => setSelectedPlayerId(e.target.value)}
                        aria-label="Player to add to this match"
                      >
                        <option value="">Add a player…</option>
                        {available.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </Select>
                      <div className="flex gap-2">
                        {sides.map(s => (
                          <button
                            key={s.side}
                            onClick={() => handleAddPlayer(match, s.side)}
                            disabled={!selectedPlayerId || addPlayer.isPending}
                            className={`${BUTTON_BASE} min-w-0 flex-1 gap-1 bg-white px-1 text-(--color-ink)`}
                          >
                            <Plus className="h-3.5 w-3.5 flex-none" />
                            <span className="truncate">To {s.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default MatchList;
