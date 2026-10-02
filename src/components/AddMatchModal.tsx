import React, { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Player, Team } from '../types';
import { TeamLogo } from './TeamLogo';
import { BottomSheet, Button, Select } from './ui';
import { useCreateMatchMutation } from '../queries/matches';

interface AddMatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchTeams: [Team, Team] | null;
  players: Player[];
  currentUserId?: string;
  onSaved: (action: 'rematch' | 'next') => void;
}

const MAX_PLAYERS_PER_TEAM = 4;

const AddMatchModal: React.FC<AddMatchModalProps> = ({
  isOpen,
  onClose,
  matchTeams,
  players,
  currentUserId,
  onSaved,
}) => {
  const [team1PlayerIds, setTeam1PlayerIds] = useState<string[]>([]);
  const [team2PlayerIds, setTeam2PlayerIds] = useState<string[]>([]);
  const [selected1, setSelected1] = useState('');
  const [selected2, setSelected2] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMatch = useCreateMatchMutation();

  // After "Save & Rematch", reopening for the same two teams keeps the same line-ups.
  const lastRematchRef = useRef<{ teamIds: [string, string]; team1PlayerIds: string[]; team2PlayerIds: string[] } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const rematch = lastRematchRef.current;
      const isRematch = rematch && matchTeams
        && rematch.teamIds[0] === matchTeams[0].id && rematch.teamIds[1] === matchTeams[1].id;
      setTeam1PlayerIds(isRematch ? rematch.team1PlayerIds : []);
      setTeam2PlayerIds(isRematch ? rematch.team2PlayerIds : []);
      setSelected1('');
      setSelected2('');
      setError(null);
    }
    // Reset only when the sheet opens — not when the matchup changes underneath it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const assignedIds = new Set([...team1PlayerIds, ...team2PlayerIds]);
  const availablePlayers = players.filter(p => !assignedIds.has(p.id));

  const addPlayer = (team: 1 | 2) => {
    const selectedId = team === 1 ? selected1 : selected2;
    if (!selectedId) return;
    const current = team === 1 ? team1PlayerIds : team2PlayerIds;
    if (current.length >= MAX_PLAYERS_PER_TEAM) {
      setError(`Maximum ${MAX_PLAYERS_PER_TEAM} players per team.`);
      return;
    }
    setError(null);
    if (team === 1) {
      setTeam1PlayerIds([...team1PlayerIds, selectedId]);
      setSelected1('');
    } else {
      setTeam2PlayerIds([...team2PlayerIds, selectedId]);
      setSelected2('');
    }
  };

  const removePlayer = (team: 1 | 2, playerId: string) => {
    if (team === 1) setTeam1PlayerIds(team1PlayerIds.filter(id => id !== playerId));
    else setTeam2PlayerIds(team2PlayerIds.filter(id => id !== playerId));
  };

  const playerName = (id: string) => players.find(p => p.id === id)?.name ?? '?';

  const handleSave = (action: 'rematch' | 'next') => {
    if (!matchTeams) return;
    if (team1PlayerIds.length === 0 && team2PlayerIds.length === 0) {
      setError('Please add at least one player to the match.');
      return;
    }

    createMatch.mutate(
      {
        team1Id: matchTeams[0].id,
        team2Id: matchTeams[1].id,
        createdBy: currentUserId ?? null,
        team1PlayerIds,
        team2PlayerIds,
      },
      {
        onSuccess: () => {
          lastRematchRef.current = action === 'rematch'
            ? { teamIds: [matchTeams[0].id, matchTeams[1].id], team1PlayerIds, team2PlayerIds }
            : null;
          onSaved(action);
          onClose();
        },
        onError: (err) => setError(err instanceof Error ? err.message : 'Failed to save match.'),
      }
    );
  };

  if (!matchTeams) return null;
  const [team1, team2] = matchTeams;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Match"
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="secondary" className="w-full" disabled={createMatch.isPending} onClick={() => handleSave('rematch')}>
            Save &amp; Rematch
          </Button>
          <Button variant="primary" className="w-full" disabled={createMatch.isPending} onClick={() => handleSave('next')}>
            Save &amp; Next Matchup
          </Button>
        </div>
      }
    >
      <div className="mb-5 flex items-center justify-center gap-3.5 border-b border-gray-200 pb-4">
        <div className="text-center">
          <TeamLogo team={team1} size="md" className="mx-auto mb-1" />
          <span className="text-xs font-bold text-(--color-ink)">{team1.name}</span>
        </div>
        <span className="text-xs font-black text-gray-400">VS</span>
        <div className="text-center">
          <TeamLogo team={team2} size="md" className="mx-auto mb-1" />
          <span className="text-xs font-bold text-(--color-ink)">{team2.name}</span>
        </div>
      </div>

      {([1, 2] as const).map(team => {
        const ids = team === 1 ? team1PlayerIds : team2PlayerIds;
        const teamName = team === 1 ? team1.name : team2.name;
        const selectedValue = team === 1 ? selected1 : selected2;
        const setSelectedValue = team === 1 ? setSelected1 : setSelected2;

        return (
          <div key={team} className="mb-5">
            <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-(--color-ink)">
              {teamName} Players ({ids.length}/{MAX_PLAYERS_PER_TEAM})
            </span>
            {ids.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {ids.map(id => (
                  <span key={id} className="inline-flex items-center gap-1 border border-(--color-ink) bg-gray-50 px-2 py-1 text-xs font-semibold text-(--color-ink)">
                    {playerName(id)}
                    <button onClick={() => removePlayer(team, id)} aria-label={`Remove ${playerName(id)}`}>
                      <X className="h-3 w-3 text-gray-500" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Select
                value={selectedValue}
                onChange={e => setSelectedValue(e.target.value)}
                disabled={ids.length >= MAX_PLAYERS_PER_TEAM}
                className="flex-1"
              >
                <option value="">Select a player...</option>
                {availablePlayers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
              <button
                onClick={() => addPlayer(team)}
                disabled={!selectedValue || ids.length >= MAX_PLAYERS_PER_TEAM}
                className="flex h-10 w-10 flex-none items-center justify-center border-2 border-(--color-ink) bg-(--color-green-mid) text-white disabled:opacity-40"
                aria-label={`Add player to ${teamName}`}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </BottomSheet>
  );
};

export default AddMatchModal;
