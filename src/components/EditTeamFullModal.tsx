import React, { useEffect, useState } from 'react';
import { Check, Download, RefreshCw, Save, Trash2, Upload } from 'lucide-react';
import { Team } from '../types';
import { TeamLogo } from './TeamLogo';
import { BottomSheet, Button, Input } from './ui';
import { useDeleteTeamMutation, useUpdateTeamMutation } from '../queries/teams';
import { fetchTeamLogoFromApiSports } from '../services/apiSportsService';
import { uploadTeamLogo } from '../services/teamUploadService';

interface EditTeamFullModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team | null;
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-(--color-ink)">{label}</span>
      {children}
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

const EditTeamFullModal: React.FC<EditTeamFullModalProps> = ({ isOpen, onClose, team }) => {
  const [formData, setFormData] = useState<Team | null>(team);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fetchingLogo, setFetchingLogo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const updateTeam = useUpdateTeamMutation();
  const deleteTeam = useDeleteTeamMutation();

  useEffect(() => {
    setFormData(team);
    setError(null);
    setSuccess(null);
  }, [team]);

  if (!team || !formData) return null;

  const handleChange = (field: keyof Team, value: string | number) => {
    setFormData(prev => (prev ? { ...prev, [field]: value } : prev));
    setSuccess(null);
  };

  const busy = updateTeam.isPending || deleteTeam.isPending || fetchingLogo || uploadingLogo;

  const handleSave = () => {
    setError(null);
    updateTeam.mutate(
      { id: team.id, updates: formData },
      { onSuccess: onClose, onError: (err) => setError(err instanceof Error ? err.message : 'Failed to update team') }
    );
  };

  const handleDelete = () => {
    if (!window.confirm(`Are you sure you want to delete ${team.name}? This action cannot be undone.`)) return;
    deleteTeam.mutate(team.id, {
      onSuccess: onClose,
      onError: (err) => setError(err instanceof Error ? err.message : 'Failed to delete team'),
    });
  };

  const persistResolvedLogo = (url: string) => {
    updateTeam.mutate(
      { id: team.id, updates: { resolvedLogoUrl: url } },
      {
        onSuccess: () => setFormData(prev => (prev ? { ...prev, resolvedLogoUrl: url } : prev)),
        onError: (err) => setError(err instanceof Error ? err.message : 'Fetched a logo but failed to save it.'),
      }
    );
  };

  const handleFetchFromApi = async () => {
    setFetchingLogo(true);
    setError(null);
    setSuccess(null);
    try {
      const logoUrl = await fetchTeamLogoFromApiSports(formData.apiTeamName || formData.name);
      if (logoUrl) {
        persistResolvedLogo(logoUrl);
        setSuccess('Logo fetched from API-Sports.');
      } else {
        setError('No logo found on API-Sports for this team name. Try setting "API Team Name" below, or upload a file instead.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logo.');
    } finally {
      setFetchingLogo(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploadingLogo(true);
    setError(null);
    setSuccess(null);
    try {
      const url = await uploadTeamLogo(team.id, file);
      persistResolvedLogo(url);
      setSuccess('Logo uploaded.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit ${team.name}`}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 border-red-600 text-red-600" onClick={handleDelete} disabled={busy}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button variant="primary" className="flex-1" onClick={handleSave} disabled={busy}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      }
    >
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
      {success && (
        <p className="mb-3 flex items-center gap-1 text-sm text-(--color-green-mid)">
          <Check className="h-4 w-4" /> {success}
        </p>
      )}

      <Field label="Team Logo">
        <div className="flex items-center gap-3">
          <TeamLogo team={formData} size="lg" />
          <div className="flex flex-1 flex-col gap-2">
            <Button variant="secondary" className="h-9 w-full text-xs" onClick={handleFetchFromApi} disabled={busy}>
              {fetchingLogo ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Fetch from API-Sports
            </Button>
            <label className="flex h-9 w-full cursor-pointer items-center justify-center gap-2 border-2 border-(--color-ink) bg-(--color-green-mid) text-xs font-bold uppercase tracking-wide text-white">
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" className="hidden" onChange={handleFileUpload} disabled={busy} />
              {uploadingLogo ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Upload New Logo
            </label>
          </div>
        </div>
      </Field>

      <Field label="Team Name">
        <Input value={formData.name} onChange={e => handleChange('name', e.target.value)} disabled={busy} />
      </Field>
      <Field label="League">
        <Input value={formData.league} onChange={e => handleChange('league', e.target.value)} disabled={busy} />
      </Field>
      <Field label="Version">
        <Input value={formData.version} onChange={e => handleChange('version', e.target.value)} disabled={busy} />
      </Field>
      <Field label="Star Rating (0.0-5.0)">
        <Input
          type="number" step={0.5} min={0} max={5}
          value={formData.rating}
          onChange={e => handleChange('rating', parseFloat(e.target.value) || 0)}
          disabled={busy}
        />
      </Field>

      <div className="grid grid-cols-2 gap-x-3">
        <Field label="Overall (0-99)">
          <Input type="number" min={0} max={99} value={formData.overallRating} onChange={e => handleChange('overallRating', parseInt(e.target.value, 10) || 0)} disabled={busy} />
        </Field>
        <Field label="Attack (0-99)">
          <Input type="number" min={0} max={99} value={formData.attackRating} onChange={e => handleChange('attackRating', parseInt(e.target.value, 10) || 0)} disabled={busy} />
        </Field>
        <Field label="Midfield (0-99)">
          <Input type="number" min={0} max={99} value={formData.midfieldRating} onChange={e => handleChange('midfieldRating', parseInt(e.target.value, 10) || 0)} disabled={busy} />
        </Field>
        <Field label="Defend (0-99)">
          <Input type="number" min={0} max={99} value={formData.defendRating} onChange={e => handleChange('defendRating', parseInt(e.target.value, 10) || 0)} disabled={busy} />
        </Field>
      </div>

      <Field
        label="API Team Name"
        hint="Used to search API-Sports/TheSportsDB for a logo — leave blank to search by the team name above."
      >
        <Input value={formData.apiTeamName ?? ''} onChange={e => handleChange('apiTeamName', e.target.value)} disabled={busy} />
      </Field>

      <Field
        label="Logo URL"
        hint="Manual fallback URL — only used if automatic/uploaded logo resolution finds nothing."
      >
        <Input value={formData.logoUrl} onChange={e => handleChange('logoUrl', e.target.value)} placeholder="https://..." disabled={busy} />
      </Field>
    </BottomSheet>
  );
};

export default EditTeamFullModal;
