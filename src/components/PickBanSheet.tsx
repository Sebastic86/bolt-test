import React, { useCallback, useMemo, useState } from 'react';
import { Ban, Check, Undo2 } from 'lucide-react';
import { Team } from '../types';
import { BottomSheet, Button } from './ui';
import { TeamLogo } from './TeamLogo';
import {
  PickBanState,
  Side,
  applyPickBanChoice,
  createPickBanState,
  getPickBanResult,
  getPickBanStep,
  getRemainingOptions,
  undoPickBanChoice,
} from '../utils/pickBan';

interface PickBanSheetProps {
  isOpen: boolean;
  onClose: () => void;
  /** Options per side, drawn once when the sheet opens. Remount (new `key`) for a new draw. */
  options: [Team[], Team[]] | null;
  /** Called with the drafted matchup [home, away]. */
  onConfirm: (match: [Team, Team]) => void;
}

const SIDE_NAMES = ['Home', 'Away'] as const;

const STEPS: Array<{ label: string; done: (s: PickBanState) => boolean }> = [
  { label: 'Home ban', done: s => s.bans[0] !== null },
  { label: 'Away ban', done: s => s.bans[1] !== null },
  { label: 'Home pick', done: s => s.picks[0] !== null },
  { label: 'Away pick', done: s => s.picks[1] !== null },
];

const TeamOption: React.FC<{
  team: Team;
  status: 'banned' | 'picked' | 'selected' | 'available' | 'idle';
  onSelect?: () => void;
}> = ({ team, status, onSelect }) => {
  const interactive = !!onSelect;
  const base = 'flex min-h-16 w-full items-center gap-2.5 border-2 border-(--color-ink) p-2 text-left';
  const tone = {
    banned: 'bg-gray-100 opacity-50',
    picked: 'bg-(--color-green-bright) shadow-hard',
    selected: 'bg-(--color-green-bright) shadow-hard',
    available: 'bg-white',
    idle: 'bg-white opacity-70',
  }[status];

  const content = (
    <>
      <TeamLogo team={team} size="md" />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-black uppercase tracking-wide text-(--color-ink) ${status === 'banned' ? 'line-through' : ''}`}>
          {team.name}
        </span>
        <span className="flex gap-1 text-[11px] font-bold text-gray-600">
          <span>ATT {team.attackRating}</span>
          <span aria-hidden="true">·</span>
          <span>MID {team.midfieldRating}</span>
          <span aria-hidden="true">·</span>
          <span>DEF {team.defendRating}</span>
        </span>
      </span>
      {status === 'banned' ? (
        <span className="flex flex-none items-center gap-1 bg-red-600 px-2 py-0.5 text-xs font-black uppercase text-white">
          <Ban className="h-3 w-3" aria-hidden="true" />
          Banned
        </span>
      ) : (
        <span className="flex-none bg-(--color-ink) px-2 py-0.5 text-xs font-black text-white">OVR {team.overallRating}</span>
      )}
      {(status === 'picked' || status === 'selected') && <Check className="h-4 w-4 flex-none text-(--color-ink)" aria-hidden="true" />}
    </>
  );

  if (!interactive) {
    return <div className={`${base} ${tone}`} aria-label={`${team.name}${status === 'banned' ? ' (banned)' : status === 'picked' ? ' (picked)' : ''}`}>{content}</div>;
  }
  return (
    <button type="button" role="radio" aria-checked={status === 'selected'} onClick={onSelect} className={`${base} ${tone}`}>
      {content}
    </button>
  );
};

/**
 * Pick & Ban draft: Home bans one of Away's options, Away bans one of
 * Home's, then each side picks from what's left. The draw is fixed for as
 * long as the sheet is open; closing it throws the draft away.
 */
const PickBanSheet: React.FC<PickBanSheetProps> = ({ isOpen, onClose, options, onConfirm }) => {
  const [state, setState] = useState<PickBanState | null>(() => (options ? createPickBanState(options) : null));
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const step = state ? getPickBanStep(state) : null;
  const result = state ? getPickBanResult(state) : null;
  const allOptions = useMemo(() => (state ? [...state.options[0], ...state.options[1]] : []), [state]);
  const selected = allOptions.find(t => t.id === selectedId) ?? null;

  const handleClose = useCallback(() => onClose(), [onClose]);

  const confirmChoice = () => {
    if (!state || !selectedId) return;
    setState(applyPickBanChoice(state, selectedId));
    setSelectedId(null);
  };

  const undo = () => {
    if (!state) return;
    setState(undoPickBanChoice(state));
    setSelectedId(null);
  };

  const canUndo = !!state && (state.bans[0] !== null || selectedId !== null);

  let footer: React.ReactNode;
  if (step?.kind === 'done' && result) {
    footer = (
      <Button className="w-full" onClick={() => { onConfirm(result); onClose(); }}>
        Play this matchup
      </Button>
    );
  } else if (step && step.kind !== 'done') {
    const verb = step.kind === 'ban' ? 'Ban' : 'Pick';
    footer = (
      <Button
        className="w-full"
        variant={step.kind === 'ban' ? 'secondary' : 'primary'}
        disabled={!selected}
        onClick={confirmChoice}
      >
        {selected ? `${verb} ${selected.name}` : `${SIDE_NAMES[step.actor]}: tap a team to ${verb.toLowerCase()}`}
      </Button>
    );
  }

  const statusFor = (team: Team, side: Side): 'banned' | 'picked' | 'selected' | 'available' | 'idle' => {
    if (!state || !step) return 'idle';
    if (state.bans[side === 0 ? 1 : 0] === team.id) return 'banned';
    if (state.picks[side] === team.id) return 'picked';
    if (step.kind !== 'done' && step.target === side) return team.id === selectedId ? 'selected' : 'available';
    return 'idle';
  };

  // The side being acted on goes first so the choice is always at the top.
  const sideOrder: Side[] = step && step.kind !== 'done' && step.target === 1 ? [1, 0] : [0, 1];

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Pick & Ban" footer={footer}>
      {!state || !step ? null : (
        <div className="flex flex-col gap-4">
          <ol className="grid grid-cols-4 gap-1" aria-label="Draft progress">
            {STEPS.map((s, i) => {
              const done = s.done(state);
              const current = !done && STEPS.slice(0, i).every(prev => prev.done(state));
              return (
                <li
                  key={s.label}
                  aria-current={current ? 'step' : undefined}
                  className={`border-2 border-(--color-ink) px-1 py-1 text-center text-[10px] font-black uppercase leading-tight tracking-wide ${
                    done ? 'bg-(--color-ink) text-white' : current ? 'bg-(--color-green-bright) text-(--color-ink)' : 'bg-white text-gray-400'
                  }`}
                >
                  {s.label}
                </li>
              );
            })}
          </ol>

          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold text-(--color-ink)">
              {step.kind === 'ban' && <><span className="font-black uppercase">{SIDE_NAMES[step.actor]}</span> bans one of {SIDE_NAMES[step.target]}'s teams.</>}
              {step.kind === 'pick' && <><span className="font-black uppercase">{SIDE_NAMES[step.actor]}</span> picks a team to play with.</>}
              {step.kind === 'done' && result && <>Draft done: <span className="font-black">{result[0].name}</span> vs <span className="font-black">{result[1].name}</span>.</>}
            </p>
            {canUndo && (
              <button
                type="button"
                onClick={selectedId ? () => setSelectedId(null) : undo}
                className="flex h-10 flex-none items-center gap-1.5 border-2 border-(--color-ink) bg-white px-2.5 text-xs font-bold uppercase tracking-wide text-(--color-ink)"
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                Undo
              </button>
            )}
          </div>

          {sideOrder.map(side => {
            const actionable = step.kind !== 'done' && step.target === side;
            const remaining = getRemainingOptions(state, side);
            return (
              <section key={side} aria-label={`${SIDE_NAMES[side]} options`}>
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-(--color-ink)">
                  <span className="mr-1.5 bg-(--color-ink) px-1.5 py-0.5 text-white">{SIDE_NAMES[side]}</span>
                  options
                </p>
                <div className="flex flex-col gap-2" role={actionable ? 'radiogroup' : undefined} aria-label={actionable ? `${SIDE_NAMES[side]} options to ${step.kind}` : undefined}>
                  {state.options[side].map(team => {
                    const status = statusFor(team, side);
                    const selectable = actionable && remaining.some(t => t.id === team.id);
                    return (
                      <TeamOption
                        key={team.id}
                        team={team}
                        status={status}
                        onSelect={selectable ? () => setSelectedId(team.id) : undefined}
                      />
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </BottomSheet>
  );
};

export default PickBanSheet;
