import React, { useEffect, useMemo, useState } from 'react';
import { Check, Edit3, Plus, RefreshCw, Save, Trash, Upload, X } from 'lucide-react';
import { Player, Team } from '../types';
import { getAvailableVersions } from '../utils/versionFilter';
import { AdminOnly } from './RoleBasedComponents';
import { BottomSheet, Button, Input, Select, Switch } from './ui';
import {
  useCreatePlayerMutation,
  useRemovePlayerAvatarMutation,
  useUpdatePlayerNameMutation,
  useUploadPlayerAvatarMutation,
} from '../queries/players';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (minRating: number, maxRating: number, excludeNations: boolean, selectedVersion: string, maxOvrDiff: number) => void;
  initialMinRating: number;
  initialMaxRating: number;
  initialExcludeNations: boolean;
  initialSelectedVersion: string;
  initialMaxOvrDiff: number;
  /** Newest version in the teams table — labelled "current season". */
  currentSeason?: string | null;
  teams: Team[];
  players: Player[];
}

function PlayerRow({ player }: { player: Player }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(player.name);
  const [error, setError] = useState<string | null>(null);

  const updateName = useUpdatePlayerNameMutation();
  const uploadAvatar = useUploadPlayerAvatarMutation();
  const removeAvatar = useRemovePlayerAvatarMutation();

  const busy = updateName.isPending || uploadAvatar.isPending || removeAvatar.isPending;

  const handleSaveName = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name cannot be empty.');
      return;
    }
    updateName.mutate(
      { id: player.id, name: trimmed },
      {
        onSuccess: () => { setEditing(false); setError(null); },
        onError: () => setError('Failed to save name.'),
      }
    );
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    uploadAvatar.mutate(
      { playerId: player.id, file },
      { onError: (err) => setError(err instanceof Error ? err.message : 'Failed to upload avatar') }
    );
    e.target.value = '';
  };

  return (
    <li className="border-2 border-gray-200 p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 flex-none items-center justify-center border border-(--color-ink) bg-gray-100 text-xs font-black text-(--color-ink)">
          {player.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={updateName.isPending}
              className="h-8 text-sm"
              autoFocus
            />
          ) : (
            <span className="block truncate text-sm font-bold text-(--color-ink)">{player.name}</span>
          )}
        </div>
        <div className="flex flex-none items-center gap-1">
          {editing ? (
            <>
              <button
                onClick={handleSaveName}
                disabled={busy || name.trim() === player.name}
                className="p-1 text-(--color-green-mid) disabled:opacity-40"
                aria-label="Save name"
              >
                {updateName.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              </button>
              <button
                onClick={() => { setEditing(false); setName(player.name); setError(null); }}
                disabled={busy}
                className="p-1 text-gray-500"
                aria-label="Cancel edit"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button onClick={() => setEditing(true)} className="p-1 text-(--color-ink)" aria-label="Edit name">
              <Edit3 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2 pl-[42px]">
        <label className="inline-flex cursor-pointer items-center gap-1 border border-(--color-ink) px-2 py-1 text-xs font-bold text-(--color-ink)">
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={busy} />
          {uploadAvatar.isPending ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {player.avatar_url ? 'Change avatar' : 'Upload avatar'}
        </label>
        {player.avatar_url && (
          <button
            onClick={() => removeAvatar.mutate(player.id, { onError: () => setError('Failed to remove avatar') })}
            disabled={busy}
            className="inline-flex items-center gap-1 border border-red-600 px-2 py-1 text-xs font-bold text-red-600"
          >
            <Trash className="h-3 w-3" />
            Remove
          </button>
        )}
      </div>

      {error && <p className="mt-1.5 pl-[42px] text-xs text-red-600">{error}</p>}
      {updateName.isSuccess && !editing && (
        <p className="mt-1.5 flex items-center gap-1 pl-[42px] text-xs text-(--color-green-mid)">
          <Check className="h-3 w-3" /> Saved
        </p>
      )}
    </li>
  );
}

function AddPlayerForm({ existingPlayers }: { existingPlayers: Player[] }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createPlayer = useCreatePlayerMutation();

  const handleAdd = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Enter a name.');
      return;
    }
    if (existingPlayers.some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('A player with this name already exists.');
      return;
    }
    createPlayer.mutate(trimmed, {
      onSuccess: () => { setName(''); setError(null); },
      onError: (err) => setError(err instanceof Error ? err.message : 'Failed to add player.'),
    });
  };

  return (
    <div className="mb-3">
      <div className="flex gap-2">
        <Input
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          placeholder="New player name..."
          disabled={createPlayer.isPending}
          className="h-9 flex-1 text-sm"
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        />
        <button
          onClick={handleAdd}
          disabled={createPlayer.isPending || !name.trim()}
          className="flex h-9 w-9 flex-none items-center justify-center border-2 border-(--color-ink) bg-(--color-green-mid) text-white disabled:opacity-40"
          aria-label="Add player"
        >
          {createPlayer.isPending ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMinRating,
  initialMaxRating,
  initialExcludeNations,
  initialSelectedVersion,
  initialMaxOvrDiff,
  currentSeason,
  teams,
  players,
}) => {
  const [minRating, setMinRating] = useState(initialMinRating);
  const [maxRating, setMaxRating] = useState(initialMaxRating);
  const [excludeNations, setExcludeNations] = useState(initialExcludeNations);
  const [selectedVersion, setSelectedVersion] = useState(initialSelectedVersion);
  const [maxOvrDiff, setMaxOvrDiff] = useState(initialMaxOvrDiff);
  const [ratingError, setRatingError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMinRating(initialMinRating);
      setMaxRating(initialMaxRating);
      setExcludeNations(initialExcludeNations);
      setSelectedVersion(initialSelectedVersion);
      setMaxOvrDiff(initialMaxOvrDiff);
      setRatingError(null);
    }
  }, [isOpen, initialMinRating, initialMaxRating, initialExcludeNations, initialSelectedVersion, initialMaxOvrDiff]);

  const availableVersions = useMemo(
    () => getAvailableVersions(teams),
    [teams]
  );

  const handleSave = () => {
    if (isNaN(minRating) || isNaN(maxRating)) {
      setRatingError('Ratings must be numbers.');
      return;
    }
    if (minRating < 0 || maxRating > 5 || minRating > maxRating) {
      setRatingError('Ratings must be between 0 and 5, with minimum ≤ maximum.');
      return;
    }
    setRatingError(null);
    onSave(minRating, maxRating, excludeNations, selectedVersion, maxOvrDiff);
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      footer={<Button variant="primary" className="w-full" onClick={handleSave}>Save &amp; Close</Button>}
    >
      <div className="mb-5">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-(--color-ink)">
          Star Rating Range
        </span>
        <div className="flex gap-2.5">
          <div className="flex-1">
            <span className="mb-1 block text-[11px] text-gray-500">Minimum</span>
            <Input type="number" min={0} max={5} step={0.5} value={minRating} onChange={e => setMinRating(parseFloat(e.target.value) || 0)} />
          </div>
          <div className="flex-1">
            <span className="mb-1 block text-[11px] text-gray-500">Maximum</span>
            <Input type="number" min={0} max={5} step={0.5} value={maxRating} onChange={e => setMaxRating(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
        {ratingError && <p className="mt-1.5 text-xs text-red-600">{ratingError}</p>}
      </div>

      <div className="mb-5">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-(--color-ink)">Game Version</span>
        <Select value={selectedVersion} onChange={e => setSelectedVersion(e.target.value)}>
          {availableVersions.length === 0 && <option value={selectedVersion}>{selectedVersion}</option>}
          {availableVersions.map(v => (
            <option key={v} value={v}>{v === currentSeason ? `${v} (current season)` : v}</option>
          ))}
        </Select>
      </div>

      <div className="mb-5">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-(--color-ink)">Max OVR Difference</span>
        <Input type="number" min={0} max={99} value={maxOvrDiff} onChange={e => setMaxOvrDiff(parseInt(e.target.value, 10) || 0)} />
        <p className="mt-1 text-[11px] text-gray-500">Largest overall-rating gap allowed when generating a random matchup.</p>
      </div>

      <div className="mb-5 flex items-center justify-between border-t-2 border-gray-100 pt-4">
        <span className="text-sm font-bold text-(--color-ink)">Exclude nation teams</span>
        <Switch checked={excludeNations} onChange={setExcludeNations} label="Exclude nation teams" />
      </div>

      <AdminOnly fallback={<p className="text-xs text-gray-500">Admin access is required to manage players.</p>}>
        <div>
          <span className="mb-2 block text-xs font-black uppercase tracking-wide text-(--color-ink)">Manage Players</span>
          <AddPlayerForm existingPlayers={players} />
          {players.length === 0 ? (
            <p className="text-xs text-gray-500">No players found.</p>
          ) : (
            <ul className="max-h-72 space-y-2 overflow-y-auto">
              {players.map(player => <PlayerRow key={player.id} player={player} />)}
            </ul>
          )}
        </div>
      </AdminOnly>
    </BottomSheet>
  );
};

export default SettingsModal;
