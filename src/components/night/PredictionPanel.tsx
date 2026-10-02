import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Lock, X } from 'lucide-react';
import { GameNight, MatchHistoryItem, Player, Prediction, Team } from '../../types';
import { Button, Card, ErrorState, Input, LoadingState } from '../ui';
import PlayerBadge from '../PlayerBadge';
import { TeamLogo } from '../TeamLogo';
import { useDeletePredictionMutation, usePlacePredictionMutation, usePredictionsQuery } from '../../queries/nights';
import { EXACT_SCORE_BONUS, getOpenPredictionsForMatchup, WINNER_POINTS } from '../../utils/predictionStats';
import {
  allPlayersPicked, findLockedPendingMatch, getLastMatchResults, MAX_PREDICTED_SCORE, PickDraft, reconcilePick, switchWinner,
} from '../../utils/predictionPanelUtils';

interface PredictionPanelProps {
  night: GameNight;
  players: Player[];
  /** Current matchup — left card = team1 (match[0]), right card = team2 (match[1]). */
  match: [Team, Team];
  /** Tonight's matches (getNightMatches). */
  nightMatches: MatchHistoryItem[];
  canWrite: boolean;
}

const errorText = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const parseScore = (value: string): number | null => {
  if (value.trim() === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
};

interface PredictionRowProps {
  player: Player;
  pick: Prediction | undefined;
  /** Every player has picked — picks are visible to all. */
  revealed: boolean;
  night: GameNight;
  match: [Team, Team];
  canWrite: boolean;
}

const PredictionRow: React.FC<PredictionRowProps> = ({ player, pick, revealed, night, match, canWrite }) => {
  const placeMutation = usePlacePredictionMutation();
  const deleteMutation = useDeletePredictionMutation();
  const [editing, setEditing] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [score1, setScore1] = useState(pick?.predicted_team1_score?.toString() ?? '');
  const [score2, setScore2] = useState(pick?.predicted_team2_score?.toString() ?? '');
  const [scoreHint, setScoreHint] = useState<string | null>(null);

  const busy = placeMutation.isPending || deleteMutation.isPending;
  const hidden = !!pick && !revealed && !editing;
  const hasScore = pick?.predicted_team1_score != null && pick?.predicted_team2_score != null;

  const save = (draft: PickDraft) => {
    placeMutation.mutate(
      {
        nightId: night.id,
        playerId: player.id,
        team1Id: match[0].id,
        team2Id: match[1].id,
        predictedWinner: draft.winner,
        predictedTeam1Score: draft.team1Score,
        predictedTeam2Score: draft.team2Score,
      },
      {
        onSuccess: () => {
          setEditing(false);
          setScoreOpen(false);
          setScoreHint(null);
          setScore1(draft.team1Score?.toString() ?? '');
          setScore2(draft.team2Score?.toString() ?? '');
        },
      }
    );
  };

  const handleToggle = (winner: 1 | 2) => {
    if (pick && pick.predicted_winner === winner) {
      deleteMutation.mutate(pick.id, {
        onSuccess: () => {
          setEditing(false);
          setScore1('');
          setScore2('');
        },
      });
      return;
    }
    save(switchWinner(pick ?? null, winner));
  };

  const handleSaveScore = () => {
    const s1 = parseScore(score1);
    const s2 = parseScore(score2);
    const valid = (s: number | null) => s !== null && s >= 0 && s <= MAX_PREDICTED_SCORE;
    if (!valid(s1) || !valid(s2)) {
      setScoreHint(`Enter both scores (0–${MAX_PREDICTED_SCORE}).`);
      return;
    }
    const winner = pick?.predicted_winner ?? (s1! > s2! ? 1 : s2! > s1! ? 2 : null);
    if (winner === null) {
      setScoreHint('A draw — first pick who wins on penalties.');
      return;
    }
    save(reconcilePick({ winner, team1Score: s1, team2Score: s2 }));
  };

  const mutationError = placeMutation.error ?? deleteMutation.error;

  return (
    <li className="flex flex-col gap-2 border-b-2 border-(--color-ink)/10 py-3 last:border-b-0">
      <div className="flex min-h-8 items-center gap-2">
        <PlayerBadge player={player} size="md" className="min-w-0 flex-1" />
        {hidden ? (
          <>
            <span className="flex flex-none items-center gap-1 bg-(--color-green-bright) px-2 py-0.5 text-xs font-black uppercase tracking-wide text-(--color-ink)">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Picked
            </span>
            {canWrite && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex h-10 flex-none items-center gap-1 border-2 border-(--color-ink) bg-white px-2.5 text-xs font-bold uppercase tracking-wide text-(--color-ink)"
                aria-label={`Change ${player.name}'s pick (reveals it)`}
              >
                <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                Change
              </button>
            )}
          </>
        ) : (
          <>
            {hasScore && (
              <span className="flex-none bg-(--color-ink) px-2 py-0.5 text-xs font-black tabular-nums text-white">
                {pick!.predicted_team1_score}–{pick!.predicted_team2_score}
              </span>
            )}
            {editing && (
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="flex h-10 flex-none items-center gap-1 border-2 border-(--color-ink) bg-white px-2.5 text-xs font-bold uppercase tracking-wide text-(--color-ink)"
              >
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                Hide
              </button>
            )}
          </>
        )}
      </div>

      {!hidden && (
        <>
          <div className="grid grid-cols-2 gap-2">
            {match.map((team, i) => {
              const side = (i + 1) as 1 | 2;
              const selected = pick?.predicted_winner === side;
              return (
                <button
                  key={team.id}
                  type="button"
                  disabled={!canWrite || busy}
                  onClick={() => handleToggle(side)}
                  aria-pressed={selected}
                  aria-label={selected ? `${team.name} picked — tap to clear` : `Pick ${team.name}`}
                  className={`flex h-12 min-w-0 items-center gap-1.5 border-2 border-(--color-ink) px-2 text-left disabled:cursor-not-allowed ${
                    selected ? 'bg-(--color-green-bright) shadow-hard' : 'bg-white'
                  } ${!canWrite ? 'disabled:opacity-70' : 'disabled:opacity-50'}`}
                >
                  <TeamLogo team={{ name: team.name, resolvedLogoUrl: team.resolvedLogoUrl, logoUrl: team.logoUrl }} size="sm" />
                  <span className="min-w-0 flex-1 truncate text-xs font-black uppercase tracking-wide text-(--color-ink)">
                    {team.name}
                  </span>
                  {selected && <Check className="h-4 w-4 flex-none text-(--color-ink)" aria-hidden="true" />}
                </button>
              );
            })}
          </div>

          {canWrite && (
            <button
              type="button"
              onClick={() => {
                if (!scoreOpen) {
                  // Prefill from the saved pick (it may have changed on another phone).
                  setScore1(pick?.predicted_team1_score?.toString() ?? '');
                  setScore2(pick?.predicted_team2_score?.toString() ?? '');
                }
                setScoreOpen(!scoreOpen);
                setScoreHint(null);
              }}
              aria-expanded={scoreOpen}
              className="flex h-10 items-center gap-1 self-start text-xs font-bold uppercase tracking-wide text-gray-600"
            >
              {scoreOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              Exact score (+{EXACT_SCORE_BONUS})
            </button>
          )}

          {canWrite && scoreOpen && (
            <div className="flex flex-col gap-2 border-2 border-(--color-ink) bg-gray-50 p-2.5">
              <div className="flex items-end gap-2">
                {[
                  { team: match[0], value: score1, set: setScore1 },
                  { team: match[1], value: score2, set: setScore2 },
                ].map(({ team, value, set }, i) => (
                  <React.Fragment key={team.id}>
                    {i === 1 && <span className="pb-2.5 text-base font-black text-(--color-ink)" aria-hidden="true">–</span>}
                    <label className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-[11px] font-black uppercase tracking-wide text-gray-600">{team.name}</span>
                      <Input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        min={0}
                        max={MAX_PREDICTED_SCORE}
                        value={value}
                        onChange={e => set(e.target.value)}
                        className="text-center text-base! font-black tabular-nums"
                      />
                    </label>
                  </React.Fragment>
                ))}
              </div>
              {scoreHint && <p className="text-xs font-bold text-red-600">{scoreHint}</p>}
              <p className="text-[11px] text-gray-500">The score sets the winner; on a draw your pick is the penalty winner.</p>
              <Button onClick={handleSaveScore} disabled={busy} className="w-full">
                {placeMutation.isPending ? 'Saving…' : 'Save score'}
              </Button>
            </div>
          )}
        </>
      )}

      {mutationError && <ErrorState message={errorText(mutationError, 'Could not save the pick.')} />}
    </li>
  );
};

/** "Who wins?" — one pick per player for the current matchup, hidden until everyone has picked. */
const PredictionPanel: React.FC<PredictionPanelProps> = ({ night, players, match, nightMatches, canWrite }) => {
  const predictionsQuery = usePredictionsQuery(night.id);
  const predictions = useMemo(() => predictionsQuery.data ?? [], [predictionsQuery.data]);

  const openPicks = useMemo(
    () => getOpenPredictionsForMatchup(predictions, night.id, match[0].id, match[1].id),
    [predictions, night.id, match]
  );
  const revealed = allPlayersPicked(players, openPicks);
  const lockedMatch = useMemo(
    () => findLockedPendingMatch(nightMatches, predictions, match[0].id, match[1].id),
    [nightMatches, predictions, match]
  );
  const lastResults = useMemo(
    () => getLastMatchResults(nightMatches, predictions, players),
    [nightMatches, predictions, players]
  );

  const pickedCount = players.filter(p => openPicks.some(pk => pk.player_id === p.id)).length;

  return (
    <Card className="p-3">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-black uppercase tracking-wide text-(--color-ink)">Who wins?</h2>
        <span className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
          {WINNER_POINTS} pt winner · +{EXACT_SCORE_BONUS} exact score
        </span>
      </div>

      {predictionsQuery.isLoading ? (
        <LoadingState label="Loading picks..." />
      ) : predictionsQuery.isError ? (
        <ErrorState className="mt-2" message={errorText(predictionsQuery.error, 'Could not load picks.')} />
      ) : (
        <>
          <p className="mt-1 flex items-center gap-1 text-xs font-bold text-gray-600">
            {revealed ? (
              <><Eye className="h-3.5 w-3.5" aria-hidden="true" /> Everyone picked — picks revealed</>
            ) : (
              <><EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> {pickedCount}/{players.length} picked · revealed when everyone has picked</>
            )}
          </p>

          {lockedMatch && (
            <p className="mt-2 flex items-center gap-1.5 border-2 border-(--color-ink) bg-yellow-50 px-2 py-1.5 text-xs font-bold text-(--color-ink)">
              <Lock className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              Locked for the saved match — result pending
            </p>
          )}

          <ul className="mt-1">
            {players.map(player => (
              <PredictionRow
                key={`${match[0].id}|${match[1].id}|${player.id}`}
                player={player}
                pick={openPicks.find(p => p.player_id === player.id)}
                revealed={revealed}
                night={night}
                match={match}
                canWrite={canWrite}
              />
            ))}
          </ul>

          {!canWrite && <p className="text-xs text-gray-500">Only members can place picks.</p>}

          {lastResults && (
            <div className="mt-2 border-t-2 border-(--color-ink) pt-2">
              <p className="truncate text-[11px] font-black uppercase tracking-wide text-gray-600">
                Last match · {lastResults.match.team1_name} {lastResults.match.team1_score}–{lastResults.match.team2_score} {lastResults.match.team2_name}
              </p>
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {lastResults.lines.map(({ player, outcome }) => (
                  <li
                    key={player.id}
                    className={`flex min-w-0 items-center gap-1.5 border-2 border-(--color-ink) px-1.5 py-1 ${
                      outcome?.correctWinner ? 'bg-(--color-green-bright)' : 'bg-white'
                    }`}
                  >
                    <PlayerBadge player={player} size="xs" />
                    {outcome === null ? (
                      <span className="text-[11px] font-black text-gray-500">–</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-[11px] font-black tabular-nums text-(--color-ink)">
                        {outcome.correctWinner
                          ? <Check className="h-3 w-3" aria-label="correct" />
                          : <X className="h-3 w-3 text-red-600" aria-label="wrong" />}
                        +{outcome.points}
                        {outcome.exactScore && <span className="ml-0.5 uppercase">exact</span>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
};

export default PredictionPanel;
