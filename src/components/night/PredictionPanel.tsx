import React, { useMemo, useState } from 'react';
import { Check, Eye, EyeOff, Lock, X } from 'lucide-react';
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

/** Shared column layout for the header and every player row: name | team 1 | team 2 | score. */
const GRID = 'grid grid-cols-[minmax(0,1fr)_2.75rem_2.75rem_3.25rem] items-center gap-1.5';

const SideNumber: React.FC<{ side: number }> = ({ side }) => (
  <span className="flex h-4 w-4 flex-none items-center justify-center bg-(--color-ink) text-[10px] font-black leading-none text-white">
    {side}
  </span>
);

interface PredictionRowProps {
  player: Player;
  pick: Prediction | undefined;
  /** Every player has picked — picks are visible to all. */
  revealed: boolean;
  night: GameNight;
  match: [Team, Team];
  canWrite: boolean;
}

/** One compact row per player: tick a column to pick the winner, tap the score chip for an exact score. */
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
  const scoreLabel = hasScore ? `${pick!.predicted_team1_score}–${pick!.predicted_team2_score}` : null;

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

  const toggleScore = () => {
    if (!scoreOpen) {
      // Prefill from the saved pick (it may have changed on another phone).
      setScore1(pick?.predicted_team1_score?.toString() ?? '');
      setScore2(pick?.predicted_team2_score?.toString() ?? '');
    }
    setScoreOpen(!scoreOpen);
    setScoreHint(null);
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
      setScoreHint('A draw — first tick who wins on penalties.');
      return;
    }
    save(reconcilePick({ winner, team1Score: s1, team2Score: s2 }));
  };

  const mutationError = placeMutation.error ?? deleteMutation.error;

  return (
    <li className="border-t border-(--color-ink)/10 py-1.5 first:border-t-0">
      <div className={GRID}>
        <PlayerBadge player={player} size="sm" className="min-w-0" />

        {hidden ? (
          <div className="col-span-3 flex h-11 items-center gap-1.5">
            <span className="flex h-full flex-1 items-center justify-center gap-1 bg-(--color-green-bright)/25 text-xs font-black uppercase tracking-wide text-(--color-ink)">
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              Picked
            </span>
            {canWrite && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="flex h-11 w-11 flex-none items-center justify-center border-2 border-(--color-ink) bg-white text-(--color-ink)"
                aria-label={`Change ${player.name}'s pick (reveals it)`}
              >
                <Eye className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ) : (
          <>
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
                  className={`flex h-11 items-center justify-center border-2 disabled:cursor-not-allowed ${
                    selected ? 'border-(--color-ink) bg-(--color-green-bright)' : 'border-gray-300 bg-white'
                  } ${!canWrite ? 'disabled:opacity-70' : 'disabled:opacity-50'}`}
                >
                  {selected
                    ? <Check className="h-5 w-5 text-(--color-ink)" strokeWidth={3} aria-hidden="true" />
                    : <span className="h-2 w-2 bg-gray-300" aria-hidden="true" />}
                </button>
              );
            })}
            <button
              type="button"
              disabled={!canWrite || busy}
              onClick={toggleScore}
              aria-expanded={scoreOpen}
              aria-label={scoreLabel
                ? `${player.name}'s exact score ${scoreLabel}, tap to change`
                : `Add exact score for ${player.name} (+${EXACT_SCORE_BONUS})`}
              className={`flex h-11 items-center justify-center border-2 text-xs font-black tabular-nums disabled:cursor-not-allowed disabled:opacity-50 ${
                scoreLabel ? 'border-(--color-ink) bg-(--color-ink) text-white' : 'border-dashed border-gray-400 bg-white text-gray-500'
              }`}
            >
              {scoreLabel ?? `+${EXACT_SCORE_BONUS}`}
            </button>
          </>
        )}
      </div>

      {canWrite && scoreOpen && !hidden && (
        <div className="mt-1.5 flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              max={MAX_PREDICTED_SCORE}
              value={score1}
              onChange={e => setScore1(e.target.value)}
              aria-label={`${match[0].name} goals`}
              className="h-11! w-16 text-center text-base! font-black tabular-nums"
            />
            <span className="text-base font-black text-(--color-ink)" aria-hidden="true">–</span>
            <Input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              min={0}
              max={MAX_PREDICTED_SCORE}
              value={score2}
              onChange={e => setScore2(e.target.value)}
              aria-label={`${match[1].name} goals`}
              className="h-11! w-16 text-center text-base! font-black tabular-nums"
            />
            <Button onClick={handleSaveScore} disabled={busy} className="h-11 flex-1 px-2">
              {placeMutation.isPending ? 'Saving…' : 'Save'}
            </Button>
            <button
              type="button"
              onClick={toggleScore}
              className="flex h-11 w-11 flex-none items-center justify-center border-2 border-(--color-ink) bg-white"
              aria-label="Close score"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p className={`text-[11px] ${scoreHint ? 'font-bold text-red-600' : 'text-gray-500'}`}>
            {scoreHint ?? 'The score sets the winner; on a draw your tick is the penalty winner.'}
          </p>
        </div>
      )}

      {editing && !hidden && (
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="mt-1 flex h-9 items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-600"
        >
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
          Hide pick again
        </button>
      )}

      {mutationError && <ErrorState className="mt-1.5" message={errorText(mutationError, 'Could not save the pick.')} />}
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
        <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-gray-500">
          {revealed
            ? <><Eye className="h-3.5 w-3.5" aria-hidden="true" /> All picked</>
            : <><EyeOff className="h-3.5 w-3.5" aria-hidden="true" /> {pickedCount}/{players.length} picked</>}
        </span>
      </div>
      <p className="mt-0.5 text-[11px] text-gray-500">
        {revealed ? 'Picks revealed.' : 'Hidden until everyone has picked.'} {WINNER_POINTS} pt for the winner, +{EXACT_SCORE_BONUS} for the exact score.
      </p>

      {predictionsQuery.isLoading ? (
        <LoadingState label="Loading picks..." />
      ) : predictionsQuery.isError ? (
        <ErrorState className="mt-2" message={errorText(predictionsQuery.error, 'Could not load picks.')} />
      ) : (
        <>
          {lockedMatch && (
            <p className="mt-2 flex items-center gap-1.5 border-2 border-(--color-ink) bg-yellow-50 px-2 py-1.5 text-xs font-bold text-(--color-ink)">
              <Lock className="h-3.5 w-3.5 flex-none" aria-hidden="true" />
              Locked for the saved match — result pending
            </p>
          )}

          {/* Column headers: crests over their tick columns, names spelled out underneath. */}
          <div className={`${GRID} mt-2 border-b-2 border-(--color-ink) pb-1.5`} aria-hidden="true">
            <span className="text-[10px] font-black uppercase tracking-wide text-gray-500">Player</span>
            {match.map((team, i) => (
              <span key={team.id} className="flex flex-col items-center gap-0.5" title={team.name}>
                <TeamLogo team={{ name: team.name, resolvedLogoUrl: team.resolvedLogoUrl, logoUrl: team.logoUrl }} size="sm" />
                <SideNumber side={i + 1} />
              </span>
            ))}
            <span className="text-center text-[10px] font-black uppercase tracking-wide text-gray-500">Score</span>
          </div>
          {/* Crests can share initials (FC Barcelona / FC Bayern) — the numbers tie names to columns. */}
          <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-(--color-ink)">
            <SideNumber side={1} />
            <span className="min-w-0 truncate">{match[0].name}</span>
            <SideNumber side={2} />
            <span className="min-w-0 truncate">{match[1].name}</span>
          </p>

          <ul className="mt-0.5">
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
