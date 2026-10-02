import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { BottomSheet, Button, Input } from './ui';
import { useCreateTeamMutation, useTeamsQuery } from '../queries/teams';
import { getAvailableVersions, getLatestVersion } from '../utils/versionFilter';

interface CreateTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type FormState = {
  name: string;
  league: string;
  version: string;
  rating: string;
  overallRating: string;
  attackRating: string;
  midfieldRating: string;
  defendRating: string;
  logoUrl: string;
};

const DEFAULT_FORM: FormState = {
  name: '',
  league: '',
  version: '', // filled with the current season when the sheet opens
  rating: '4',
  overallRating: '75',
  attackRating: '75',
  midfieldRating: '75',
  defendRating: '75',
  logoUrl: '',
};

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-(--color-ink)">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

const CreateTeamModal: React.FC<CreateTeamModalProps> = ({ isOpen, onClose }) => {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [error, setError] = useState<string | null>(null);
  const createTeam = useCreateTeamMutation();
  // New teams default to the current season (newest version, e.g. FC27).
  const teamsQuery = useTeamsQuery();
  const currentSeason = getLatestVersion(getAvailableVersions(teamsQuery.data ?? [])) ?? '';

  useEffect(() => {
    if (isOpen) {
      setForm({ ...DEFAULT_FORM, version: currentSeason });
      setError(null);
    }
    // Reset only when the sheet opens, not when teams refetch while it is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const update = (field: keyof FormState, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleCreate = () => {
    const name = form.name.trim();
    const league = form.league.trim();
    if (!name || !league) {
      setError('Team name and league are required.');
      return;
    }

    const rating = parseFloat(form.rating);
    const overallRating = parseInt(form.overallRating, 10);
    const attackRating = parseInt(form.attackRating, 10);
    const midfieldRating = parseInt(form.midfieldRating, 10);
    const defendRating = parseInt(form.defendRating, 10);

    if ([rating, overallRating, attackRating, midfieldRating, defendRating].some(Number.isNaN)) {
      setError('All ratings must be numbers.');
      return;
    }
    if (rating < 0 || rating > 5) {
      setError('Star rating must be between 0 and 5.');
      return;
    }
    if ([overallRating, attackRating, midfieldRating, defendRating].some(v => v < 0 || v > 99)) {
      setError('OVR/ATT/MID/DEF ratings must be between 0 and 99.');
      return;
    }

    createTeam.mutate(
      {
        name,
        league,
        version: form.version.trim() || currentSeason,
        rating,
        overallRating,
        attackRating,
        midfieldRating,
        defendRating,
        logoUrl: form.logoUrl.trim(),
      },
      {
        onSuccess: onClose,
        onError: (err) => setError(err instanceof Error ? err.message : 'Failed to create team.'),
      }
    );
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Add Team"
      footer={
        <Button variant="primary" className="w-full" onClick={handleCreate} disabled={createTeam.isPending}>
          <Plus className="h-4 w-4" /> {createTeam.isPending ? 'Creating...' : 'Create Team'}
        </Button>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <Field label="Team Name">
        <Input value={form.name} onChange={e => update('name', e.target.value)} disabled={createTeam.isPending} autoFocus />
      </Field>
      <Field label="League">
        <Input value={form.league} onChange={e => update('league', e.target.value)} disabled={createTeam.isPending} />
      </Field>
      <Field label="Version">
        <Input value={form.version} onChange={e => update('version', e.target.value)} disabled={createTeam.isPending} />
      </Field>
      <Field label="Star Rating (0.0-5.0)">
        <Input type="number" step={0.5} min={0} max={5} value={form.rating} onChange={e => update('rating', e.target.value)} disabled={createTeam.isPending} />
      </Field>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Overall (0-99)">
          <Input type="number" min={0} max={99} value={form.overallRating} onChange={e => update('overallRating', e.target.value)} disabled={createTeam.isPending} />
        </Field>
        <Field label="Attack (0-99)">
          <Input type="number" min={0} max={99} value={form.attackRating} onChange={e => update('attackRating', e.target.value)} disabled={createTeam.isPending} />
        </Field>
        <Field label="Midfield (0-99)">
          <Input type="number" min={0} max={99} value={form.midfieldRating} onChange={e => update('midfieldRating', e.target.value)} disabled={createTeam.isPending} />
        </Field>
        <Field label="Defend (0-99)">
          <Input type="number" min={0} max={99} value={form.defendRating} onChange={e => update('defendRating', e.target.value)} disabled={createTeam.isPending} />
        </Field>
      </div>

      <Field
        label="Logo URL (optional)"
        hint="Can be left blank — team badges use colored initials until automatic logo fetching is wired up."
      >
        <Input value={form.logoUrl} onChange={e => update('logoUrl', e.target.value)} placeholder="https://..." disabled={createTeam.isPending} />
      </Field>
    </BottomSheet>
  );
};

export default CreateTeamModal;
