import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Pencil, RefreshCw, Save, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Team } from '../types';
import { BottomSheet, Button, ErrorState, Input, LoadingState, useToast } from './ui';
import { useUpdateTeamMutation } from '../queries/teams';
import { searchFifaIndexTeams } from '../services/fifaIndexService';
import {
  COMPARED_FIELDS,
  FIELD_LABELS,
  SyncedField,
  compareTeam,
  findSameTeam,
  leavesStarFilter,
  starRatingFor,
  syncedValues,
} from '../utils/teamDataDiff';

interface TeamDataCheckSheetProps {
  /** The team to check; null keeps the sheet closed. */
  team: Team | null;
  onClose: () => void;
  /** Called with the saved row so the caller can refresh what it shows. */
  onUpdated: (team: Team) => void;
  /** The dashboard's star filter — an update that leaves it redraws the matchup. */
  starFilter: { minRating: number; maxRating: number };
}

const FIELDS = COMPARED_FIELDS;

const formatValue = (field: SyncedField, value: string | number) =>
  field === 'rating' ? Number(value).toFixed(1) : String(value);

type RatingField = 'overallRating' | 'attackRating' | 'midfieldRating' | 'defendRating';
const RATING_FIELDS: RatingField[] = ['overallRating', 'attackRating', 'midfieldRating', 'defendRating'];
/** Typed values stay strings so a field can be cleared while typing. */
type Draft = Record<RatingField | 'rating', string>;

const draftFrom = (team: Team): Draft => ({
  overallRating: String(team.overallRating),
  attackRating: String(team.attackRating),
  midfieldRating: String(team.midfieldRating),
  defendRating: String(team.defendRating),
  rating: String(team.rating),
});

const validRating = (value: string) => /^\d{1,2}$/.test(value.trim());
const validStars = (value: string) => {
  const stars = Number(value);
  return value.trim() !== '' && stars >= 0 && stars <= 5 && Number.isInteger(stars * 2);
};

/**
 * Admin check of one team against FIFA Index's current ratings — for when
 * the ratings in the game differ from the card. Shows a side-by-side preview
 * first; nothing is written until "Update team" is tapped.
 */
const TeamDataCheckSheet: React.FC<TeamDataCheckSheetProps> = ({ team, onClose, onUpdated, starFilter }) => {
  const { toast } = useToast();
  const updateMutation = useUpdateTeamMutation();
  const [keyword, setKeyword] = useState('');
  const [searchFor, setSearchFor] = useState('');
  const [pickedId, setPickedId] = useState<number | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  // Stars follow OVR until the admin sets them.
  const [starsTouched, setStarsTouched] = useState(false);

  // Start every opening with a search for the team's own name.
  useEffect(() => {
    setKeyword(team?.name ?? '');
    setSearchFor(team?.name ?? '');
    setPickedId(null);
    setManualOpen(false);
    setDraft(team ? draftFrom(team) : null);
    setStarsTouched(false);
    updateMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id]);

  const search = useQuery({
    queryKey: ['fifaindex-team-search', searchFor],
    queryFn: () => searchFifaIndexTeams(searchFor),
    enabled: !!team && searchFor.trim().length > 0,
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (!team) return null;

  const page = search.data;
  const versionMismatch = !!page?.version && page.version !== team.version;
  const source = page ? (page.teams.find(t => t.teamId === pickedId) ?? findSameTeam(team, page.teams)) : null;
  const update = source ? compareTeam(team, source) : null;
  const next = source ? syncedValues(source) : null;
  const changed = new Set(update?.changes.map(c => c.field));
  const upToDate = !!update && update.changes.length === 0;
  const canUpdate = !!update && !upToDate && !versionMismatch && !updateMutation.isPending;

  // By hand: FIFA Index blocks automated lookups, so the admin can type the in-game ratings instead.
  const manual = manualOpen || search.isError;
  const manualValid = !!draft && RATING_FIELDS.every(f => validRating(draft[f])) && validStars(draft.rating);
  const manualUpdates: Partial<Team> = {};
  if (draft && manualValid) {
    for (const f of RATING_FIELDS) if (Number(draft[f]) !== team[f]) manualUpdates[f] = Number(draft[f]);
    if (Number(draft.rating) !== team.rating) manualUpdates.rating = Number(draft.rating);
  }
  const manualChanged = Object.keys(manualUpdates).length > 0;
  const canSaveManual = manualValid && manualChanged && !updateMutation.isPending;
  const manualStars = manualUpdates.rating;
  const manualLeavesFilter =
    manualStars !== undefined && (manualStars < starFilter.minRating || manualStars > starFilter.maxRating);

  const setDraftField = (field: RatingField, value: string) =>
    setDraft(prev => {
      if (!prev) return prev;
      const next = { ...prev, [field]: value };
      if (field === 'overallRating' && !starsTouched && validRating(value)) next.rating = String(starRatingFor(Number(value)));
      return next;
    });

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPickedId(null);
    setSearchFor(keyword.trim());
  };

  const save = (updates: Partial<Team>) =>
    updateMutation.mutate(
      { id: team.id, updates },
      {
        onSuccess: saved => {
          toast({ variant: 'success', title: `${saved.name} updated`, detail: `Now OVR ${saved.overallRating} · ★ ${saved.rating.toFixed(1)}` });
          onUpdated(saved);
          onClose();
        },
      }
    );

  const handleUpdate = () => {
    if (manual) {
      if (canSaveManual) save(manualUpdates);
    } else if (update && canUpdate) {
      save(update.updates);
    }
  };

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title="Check team data"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={onClose} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={manual ? !canSaveManual : !canUpdate}>
            {manual ? (
              <>
                <Save className="h-4 w-4" /> {updateMutation.isPending ? 'Saving…' : 'Save ratings'}
              </>
            ) : upToDate ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Up to date
              </>
            ) : (
              <>
                <RefreshCw className={`h-4 w-4 ${updateMutation.isPending ? 'animate-spin' : ''}`} />
                {updateMutation.isPending ? 'Saving…' : 'Update team'}
              </>
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-gray-600">
          Compares <strong className="text-(--color-ink)">{team.name}</strong> ({team.version}) with FIFA Index's
          ratings — the ones shown in the game — or lets you enter them by hand. Nothing changes until you save.
        </p>

        {!manual && (
          <form onSubmit={runSearch} className="flex gap-2">
            <Input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              aria-label="FIFA Index search"
              placeholder="Team name on FIFA Index"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="outline" className="flex-none px-3" aria-label="Search FIFA Index" disabled={!keyword.trim()}>
              <Search className="h-4 w-4" />
            </Button>
          </form>
        )}

        {!manual && search.isFetching && <LoadingState label={`Looking up "${searchFor}" on FIFA Index…`} />}
        {search.isError && !search.isFetching && (
          <ErrorState message={search.error instanceof Error ? search.error.message : 'FIFA Index lookup failed.'} />
        )}

        {manual && draft && (
          <div>
            <p className="mb-1 text-xs font-black uppercase tracking-wide text-(--color-ink)">Enter the ratings by hand</p>
            <p className="mb-3 text-xs text-gray-600">Copy them from the team select screen in the game.</p>
            <div className="grid grid-cols-2 gap-3">
              {RATING_FIELDS.map(field => (
                <label key={field} className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-600">{FIELD_LABELS[field]}</span>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99}
                    value={draft[field]}
                    onChange={e => setDraftField(field, e.target.value)}
                    aria-invalid={!validRating(draft[field])}
                    disabled={updateMutation.isPending}
                    className="h-11 tabular-nums"
                  />
                </label>
              ))}
              <div className="col-span-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-black uppercase tracking-wide text-gray-600">{FIELD_LABELS.rating} Stars</span>
                  <Input
                    aria-describedby="manual-stars-hint"
                    type="number"
                    inputMode="decimal"
                    step={0.5}
                    min={0}
                    max={5}
                    value={draft.rating}
                    onChange={e => {
                      setStarsTouched(true);
                      setDraft(prev => (prev ? { ...prev, rating: e.target.value } : prev));
                    }}
                    aria-invalid={!validStars(draft.rating)}
                    disabled={updateMutation.isPending}
                    className="h-11 tabular-nums"
                  />
                </label>
                <p id="manual-stars-hint" className="mt-1 text-[11px] text-gray-500">
                  {starsTouched ? 'Set by hand.' : 'Follows OVR. Change it if the game shows different stars.'}
                </p>
              </div>
            </div>

            {!manualValid && (
              <p role="alert" className="mt-2 text-xs font-bold text-red-600">
                Ratings must be whole numbers from 0 to 99, and stars 0–5 in steps of 0.5.
              </p>
            )}
            {manualValid && !manualChanged && <p className="mt-2 text-xs text-gray-500">Same as the current ratings.</p>}
            {manualValid && manualLeavesFilter && (
              <p role="alert" className="mt-2 flex items-start gap-2 border-2 border-yellow-400 bg-yellow-50 p-2.5 text-xs font-bold text-(--color-ink)">
                <AlertTriangle className="h-4 w-4 flex-none text-yellow-700" aria-hidden="true" />
                ★ {manualStars?.toFixed(1)} is outside your star filter ({starFilter.minRating.toFixed(1)}–
                {starFilter.maxRating.toFixed(1)}) — a new matchup will be drawn after saving.
              </p>
            )}
            {!search.isError && (
              <button
                type="button"
                onClick={() => setManualOpen(false)}
                className="mt-2 min-h-11 text-xs font-bold uppercase tracking-wide text-gray-500 underline"
              >
                Back to FIFA Index
              </button>
            )}
          </div>
        )}

        {!manual && !search.isFetching && (
          <button
            type="button"
            onClick={() => setManualOpen(true)}
            className="flex min-h-11 items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-500 underline"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" /> Enter ratings by hand
          </button>
        )}

        {!manual && page && !search.isFetching && (
          <>
            {versionMismatch && (
              <p role="alert" className="flex items-start gap-2 border-2 border-yellow-400 bg-yellow-50 p-2.5 text-xs font-bold text-(--color-ink)">
                <AlertTriangle className="h-4 w-4 flex-none text-yellow-700" aria-hidden="true" />
                FIFA Index only has {page.version} data — this team is {team.version}, so it can't be updated from here.
              </p>
            )}

            {!source && (
              page.teams.length === 0 ? (
                <p className="text-sm text-gray-600">No team found for "{searchFor}". Try another spelling above.</p>
              ) : (
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Which one is {team.name}?</p>
                  <ul className="space-y-1.5">
                    {page.teams.slice(0, 8).map(candidate => (
                      <li key={candidate.teamId}>
                        <button
                          type="button"
                          onClick={() => setPickedId(candidate.teamId)}
                          className="flex min-h-11 w-full items-center justify-between gap-2 border-2 border-(--color-ink) bg-white px-3 py-2 text-left"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-black text-(--color-ink)">{candidate.name}</span>
                            <span className="block truncate text-xs text-gray-500">{candidate.league ?? 'Nation'}</span>
                          </span>
                          <span className="flex-none bg-(--color-ink) px-2 py-0.5 text-xs font-black text-white">OVR {candidate.overall}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            )}

            {source && update && next && (
              <div>
                <div className="mb-2 flex items-baseline justify-between gap-2 text-xs">
                  <span className="min-w-0 truncate font-black uppercase tracking-wide text-(--color-ink)">
                    FIFA Index: {source.name}
                  </span>
                  <span className="flex-none text-gray-500">
                    {page.version}
                  </span>
                </div>
                <table className="w-full border-2 border-(--color-ink) text-sm">
                  <thead>
                    <tr className="bg-(--color-ink) text-left text-[11px] uppercase tracking-wide text-white">
                      <th className="px-2 py-1.5 font-black"><span className="sr-only">Field</span></th>
                      <th className="px-2 py-1.5 font-black">Now</th>
                      <th className="px-2 py-1.5 font-black">FIFA Index</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FIELDS.map(field => {
                      const isChanged = changed.has(field);
                      return (
                        <tr key={field} className={`border-t border-gray-200 ${isChanged ? 'bg-(--color-green-bright)/25' : ''}`}>
                          <th scope="row" className="px-2 py-1.5 text-left text-xs font-black uppercase text-gray-600">
                            {FIELD_LABELS[field]}
                          </th>
                          <td className={`px-2 py-1.5 tabular-nums ${isChanged ? 'text-gray-500 line-through' : 'text-(--color-ink)'}`}>
                            {formatValue(field, team[field])}
                          </td>
                          <td className={`px-2 py-1.5 tabular-nums text-(--color-ink) ${isChanged ? 'font-black' : ''}`}>
                            {formatValue(field, next[field])}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {upToDate && !versionMismatch && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-bold text-(--color-green-mid)">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Already matches FIFA Index.
                  </p>
                )}
                {!upToDate && !versionMismatch && leavesStarFilter(update, starFilter) && (
                  <p role="alert" className="mt-2 flex items-start gap-2 border-2 border-yellow-400 bg-yellow-50 p-2.5 text-xs font-bold text-(--color-ink)">
                    <AlertTriangle className="h-4 w-4 flex-none text-yellow-700" aria-hidden="true" />
                    ★ {update.updates.rating?.toFixed(1)} is outside your star filter ({starFilter.minRating.toFixed(1)}–
                    {starFilter.maxRating.toFixed(1)}) — a new matchup will be drawn after updating.
                  </p>
                )}
                {pickedId !== null && (
                  <button
                    type="button"
                    onClick={() => setPickedId(null)}
                    className="mt-2 text-xs font-bold uppercase tracking-wide text-gray-500 underline"
                  >
                    Pick another team
                  </button>
                )}
              </div>
            )}
          </>
        )}

        {updateMutation.isError && (
          <ErrorState message={updateMutation.error instanceof Error ? updateMutation.error.message : 'Update failed.'} />
        )}
      </div>
    </BottomSheet>
  );
};

export default TeamDataCheckSheet;
