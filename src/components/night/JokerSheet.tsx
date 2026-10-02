import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, Check, Shuffle } from 'lucide-react';
import { GameNight, NightJoker, Player, Team } from '../../types';
import { BottomSheet, Button, ErrorState } from '../ui';
import PlayerBadge from '../PlayerBadge';
import { TeamLogo } from '../TeamLogo';
import { useJokerMutation } from '../../queries/nights';
import { getJokersRemaining } from '../../utils/nightStats';
import { pickJokerCandidates } from '../../utils/jokerCandidates';

interface JokerSheetProps {
  isOpen: boolean;
  onClose: () => void;
  night: GameNight;
  jokers: NightJoker[];
  players: Player[];
  match: [Team, Team];
  /** Teams a joker may draw from (current filters, not played today). */
  pool: Team[];
  maxOvrDiff: number;
  /** Called only after the joker was saved. */
  onSwap: (team: Team, slot: 0 | 1) => void;
}

const StepLabel: React.FC<{ step: number; children: React.ReactNode }> = ({ step, children }) => (
  <p className="mb-2 text-xs font-black uppercase tracking-wide text-(--color-ink)">
    <span className="mr-1.5 bg-(--color-ink) px-1.5 py-0.5 text-white">{step}</span>
    {children}
  </p>
);

const StatTiles: React.FC<{ team: Team }> = ({ team }) => (
  <span className="flex gap-1 text-[11px] font-bold text-gray-600">
    <span>ATT {team.attackRating}</span>
    <span aria-hidden="true">·</span>
    <span>MID {team.midfieldRating}</span>
    <span aria-hidden="true">·</span>
    <span>DEF {team.defendRating}</span>
  </span>
);

/**
 * Spend a joker: pick who, pick the side to replace, then choose one of
 * (up to) 3 teams drawn once for this matchup + side. The draw is cached
 * while the dashboard stays mounted, so closing/reopening or going back
 * can't re-roll it — only a new matchup does.
 */
const JokerSheet: React.FC<JokerSheetProps> = ({
  isOpen, onClose, night, jokers, players, match, pool, maxOvrDiff, onSwap,
}) => {
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [slot, setSlot] = useState<0 | 1 | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);
  const [draws, setDraws] = useState<Record<string, Team[]>>({});
  const jokerMutation = useJokerMutation();

  const remaining = useMemo(
    () => getJokersRemaining(players, jokers, night.jokers_per_player),
    [players, jokers, night.jokers_per_player]
  );

  const drawKey = (s: 0 | 1) => `${match[0].id}|${match[1].id}|${s}`;
  const candidates = slot !== null ? draws[drawKey(slot)] ?? [] : [];
  const chosen = candidates.find(t => t.id === chosenId) ?? null;
  const player = players.find(p => p.id === playerId) ?? null;

  const { reset: resetMutation, isPending } = jokerMutation;
  const reset = useCallback(() => {
    setPlayerId(null);
    setSlot(null);
    setChosenId(null);
    resetMutation();
  }, [resetMutation]);

  // Stable identity: BottomSheet re-runs its focus effect when onClose changes.
  const handleClose = useCallback(() => {
    if (isPending) return;
    reset();
    onClose();
  }, [isPending, reset, onClose]);

  const handlePickSlot = (s: 0 | 1) => {
    const key = drawKey(s);
    if (!draws[key]) {
      const opponent = match[s === 0 ? 1 : 0];
      const drawn = pickJokerCandidates({ pool, opponent, excludeIds: [match[0].id, match[1].id], maxOvrDiff });
      setDraws(prev => ({ ...prev, [key]: drawn }));
    }
    setChosenId(null);
    setSlot(s);
  };

  const handleConfirm = () => {
    if (!playerId || slot === null || !chosen) return;
    jokerMutation.mutate(
      { nightId: night.id, playerId, replacedTeamId: match[slot].id, chosenTeamId: chosen.id },
      {
        onSuccess: () => {
          onSwap(chosen, slot);
          reset();
          onClose();
        },
      }
    );
  };

  const goBack = () => {
    jokerMutation.reset();
    if (slot !== null) {
      setSlot(null);
      setChosenId(null);
    } else {
      setPlayerId(null);
    }
  };

  const footer = player && slot !== null && candidates.length > 0 ? (
    <Button className="w-full" disabled={!chosen || jokerMutation.isPending} onClick={handleConfirm}>
      {jokerMutation.isPending ? 'Using joker…' : chosen ? `Use joker · ${chosen.name}` : 'Pick a team'}
    </Button>
  ) : undefined;

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Joker" footer={footer}>
      <div className="flex flex-col gap-4">
        {(player || slot !== null) && (
          <button
            type="button"
            onClick={goBack}
            disabled={jokerMutation.isPending}
            className="flex h-10 items-center gap-1.5 self-start text-xs font-bold uppercase tracking-wide text-(--color-ink) disabled:opacity-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        )}

        {!player && (
          <section>
            <StepLabel step={1}>Who plays the joker?</StepLabel>
            <div className="grid grid-cols-2 gap-2">
              {players.map(p => {
                const left = remaining.get(p.id) ?? 0;
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={left === 0}
                    onClick={() => setPlayerId(p.id)}
                    className="flex min-h-12 min-w-0 flex-col items-start justify-center gap-0.5 border-2 border-(--color-ink) bg-white px-2.5 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <PlayerBadge player={p} size="md" className="max-w-full" />
                    <span className="text-[11px] font-black uppercase tracking-wide text-gray-500">
                      {left} left
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {player && slot === null && (
          <section>
            <StepLabel step={2}>Which team goes?</StepLabel>
            <div className="flex flex-col gap-2">
              {match.map((team, i) => (
                <button
                  key={team.id}
                  type="button"
                  onClick={() => handlePickSlot(i as 0 | 1)}
                  className="flex min-h-14 items-center gap-2.5 border-2 border-(--color-ink) bg-white p-2 text-left"
                >
                  <TeamLogo team={team} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-black uppercase tracking-wide text-(--color-ink)">{team.name}</span>
                    <span className="block text-xs font-bold text-gray-500">OVR {team.overallRating}</span>
                  </span>
                  <Shuffle className="h-4 w-4 flex-none text-gray-500" aria-hidden="true" />
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              <span className="font-bold text-(--color-ink)">{player.name}</span> spends 1 of {remaining.get(player.id) ?? 0} jokers.
            </p>
          </section>
        )}

        {player && slot !== null && (
          <section>
            <StepLabel step={3}>Replace {match[slot].name} with…</StepLabel>
            {candidates.length === 0 ? (
              <ErrorState
                message={`No team fits against ${match[slot === 0 ? 1 : 0].name} (same filters, max OVR diff ${maxOvrDiff}, not played today). Try the other side.`}
              />
            ) : (
              <div className="flex flex-col gap-2" role="radiogroup" aria-label="Joker candidates">
                {candidates.map(team => {
                  const selected = team.id === chosenId;
                  return (
                    <button
                      key={team.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => setChosenId(team.id)}
                      className={`flex min-h-16 items-center gap-2.5 border-2 border-(--color-ink) p-2 text-left ${
                        selected ? 'bg-(--color-green-bright) shadow-hard' : 'bg-white'
                      }`}
                    >
                      <TeamLogo team={team} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-black uppercase tracking-wide text-(--color-ink)">{team.name}</span>
                        <StatTiles team={team} />
                      </span>
                      <span className="flex-none bg-(--color-ink) px-2 py-0.5 text-xs font-black text-white">
                        OVR {team.overallRating}
                      </span>
                      {selected && <Check className="h-4 w-4 flex-none text-(--color-ink)" aria-hidden="true" />}
                    </button>
                  );
                })}
                {candidates.length < 3 && (
                  <p className="text-xs text-gray-500">Only {candidates.length} team{candidates.length === 1 ? '' : 's'} fit the current filters.</p>
                )}
              </div>
            )}
            <p className="mt-2 text-xs text-gray-500">One draw per matchup — no re-rolls.</p>
          </section>
        )}

        {jokerMutation.isError && (
          <ErrorState message={jokerMutation.error instanceof Error ? jokerMutation.error.message : 'Could not use the joker.'} />
        )}
      </div>
    </BottomSheet>
  );
};

export default JokerSheet;
