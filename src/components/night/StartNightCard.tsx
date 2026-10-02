import React, { useState } from 'react';
import { Check, Moon } from 'lucide-react';
import { PlayerBadge } from '../PlayerBadge';
import { Player } from '../../types';
import { SegmentedControl } from '../stats/SegmentedControl';
import { Button, Card, ErrorState, Select } from '../ui';

interface StartNightCardProps {
  versions: string[];
  defaultVersion: string;
  onStart: (input: { version: string | null; jokersPerPlayer: number; playerIds: string[] }) => void;
  starting: boolean;
  error: string | null;
  /** False for signed-in users without a role (RLS would reject the insert). */
  canStart: boolean;
  players: Player[];
}

type JokerOption = '0' | '1' | '2' | '3';
const JOKER_OPTIONS: { value: JokerOption; label: string }[] = ['0', '1', '2', '3'].map(v => ({ value: v as JokerOption, label: v }));

const StartNightCard: React.FC<StartNightCardProps> = ({ versions, defaultVersion, onStart, starting, error, canStart, players }) => {
  const fallbackVersion = versions.includes(defaultVersion) ? defaultVersion : versions[0] ?? '';
  const [pickedVersion, setVersion] = useState<string | null>(null);
  // Teams may still be loading on first render — fall back until the user picks one.
  const version = pickedVersion !== null && versions.includes(pickedVersion) ? pickedVersion : fallbackVersion;
  const [jokers, setJokers] = useState<JokerOption>('1');
  // null = untouched → everyone plays (players may still be loading).
  const [pickedIds, setPickedIds] = useState<string[] | null>(null);
  const playerIds = pickedIds ?? players.map(p => p.id);
  const togglePlayer = (id: string) =>
    setPickedIds(playerIds.includes(id) ? playerIds.filter(p => p !== id) : [...playerIds, id]);
  const enoughPlayers = playerIds.length >= 2;

  return (
    <Card hard className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Moon className="h-5 w-5 text-(--color-green-mid)" />
        <h2 className="text-base font-black uppercase tracking-wide text-(--color-ink)">Start a game night</h2>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Every match added while the night runs counts towards tonight's table, predictions and recap.
      </p>

      <label className="mb-1 block text-xs font-black uppercase tracking-wide text-(--color-ink)" htmlFor="night-version">
        Version
      </label>
      <Select id="night-version" value={version} onChange={e => setVersion(e.target.value)} className="mb-3">
        {versions.length === 0 && <option value="">No versions</option>}
        {versions.map(v => (
          <option key={v} value={v}>{v}</option>
        ))}
      </Select>

      <p className="mb-1 text-xs font-black uppercase tracking-wide text-(--color-ink)">Who's playing tonight?</p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {players.map(player => {
          const selected = playerIds.includes(player.id);
          return (
            <button
              key={player.id}
              type="button"
              aria-pressed={selected}
              onClick={() => togglePlayer(player.id)}
              className={`flex min-h-11 items-center justify-between gap-2 border-2 px-2 text-left ${selected ? 'border-(--color-ink) bg-(--color-green-bright)/20' : 'border-gray-300 bg-white opacity-60'}`}
            >
              <PlayerBadge player={player} size="sm" className="min-w-0 uppercase" />
              {selected && <Check className="h-4 w-4 flex-none text-(--color-green-mid)" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      {!enoughPlayers && <p className="-mt-1 mb-3 text-xs font-bold text-red-600">Pick at least 2 players.</p>}

      <p className="mb-1 text-xs font-black uppercase tracking-wide text-(--color-ink)">Jokers per player</p>
      <SegmentedControl<JokerOption>
        ariaLabel="Jokers per player"
        className="mb-4"
        value={jokers}
        onChange={setJokers}
        options={JOKER_OPTIONS}
      />

      {error && <ErrorState className="mb-3" message={error} />}

      <Button
        className="h-12 w-full text-base"
        disabled={starting || !canStart || !enoughPlayers}
        onClick={() => onStart({ version: version || null, jokersPerPlayer: Number(jokers), playerIds })}
      >
        <Moon className="h-5 w-5" />
        {starting ? 'Starting…' : 'Start game night'}
      </Button>
      {!canStart && (
        <p className="mt-2 text-center text-xs text-gray-500">Only players with an account role can start a night.</p>
      )}
    </Card>
  );
};

export default StartNightCard;
