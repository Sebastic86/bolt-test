import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Team } from '../types';
import { BottomSheet, Button, ErrorState, Input, LoadingState, useToast } from './ui';
import { useUpdateTeamMutation } from '../queries/teams';
import { searchSofifaTeams } from '../services/sofifaService';
import {
  FIELD_LABELS,
  SyncedField,
  compareTeam,
  findSameTeam,
  leavesStarFilter,
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

const FIELDS: SyncedField[] = ['overallRating', 'attackRating', 'midfieldRating', 'defendRating', 'rating', 'league'];

const formatValue = (field: SyncedField, value: string | number) =>
  field === 'rating' ? Number(value).toFixed(1) : String(value);

/**
 * Admin check of one team against SoFIFA's latest roster update — for when
 * the ratings in the game differ from the card. Shows a side-by-side preview
 * first; nothing is written until "Update team" is tapped.
 */
const TeamDataCheckSheet: React.FC<TeamDataCheckSheetProps> = ({ team, onClose, onUpdated, starFilter }) => {
  const { toast } = useToast();
  const updateMutation = useUpdateTeamMutation();
  const [keyword, setKeyword] = useState('');
  const [searchFor, setSearchFor] = useState('');
  const [pickedId, setPickedId] = useState<number | null>(null);

  // Start every opening with a search for the team's own name.
  useEffect(() => {
    setKeyword(team?.name ?? '');
    setSearchFor(team?.name ?? '');
    setPickedId(null);
    updateMutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [team?.id]);

  const search = useQuery({
    queryKey: ['sofifa-team-search', searchFor],
    queryFn: () => searchSofifaTeams(searchFor),
    enabled: !!team && searchFor.trim().length > 0,
    retry: false,
    staleTime: 5 * 60_000,
  });

  if (!team) return null;

  const page = search.data;
  const versionMismatch = !!page?.version && page.version !== team.version;
  const source = page ? (page.teams.find(t => t.sofifaId === pickedId) ?? findSameTeam(team, page.teams)) : null;
  const update = source ? compareTeam(team, source) : null;
  const next = source ? syncedValues(source) : null;
  const changed = new Set(update?.changes.map(c => c.field));
  const upToDate = !!update && update.changes.length === 0;
  const canUpdate = !!update && !upToDate && !versionMismatch && !updateMutation.isPending;

  const runSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPickedId(null);
    setSearchFor(keyword.trim());
  };

  const handleUpdate = () => {
    if (!update || !canUpdate) return;
    updateMutation.mutate(
      { id: team.id, updates: update.updates },
      {
        onSuccess: saved => {
          toast({ variant: 'success', title: `${saved.name} updated`, detail: `Now OVR ${saved.overallRating} · ★ ${saved.rating.toFixed(1)}` });
          onUpdated(saved);
          onClose();
        },
      }
    );
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
          <Button onClick={handleUpdate} disabled={!canUpdate}>
            {upToDate ? (
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
          Compares <strong className="text-(--color-ink)">{team.name}</strong> ({team.version}) with SoFIFA's latest roster
          update — the ratings shown in the game. Nothing changes until you tap Update team.
        </p>

        <form onSubmit={runSearch} className="flex gap-2">
          <Input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            aria-label="SoFIFA search"
            placeholder="Team name on SoFIFA"
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" className="flex-none px-3" aria-label="Search SoFIFA" disabled={!keyword.trim()}>
            <Search className="h-4 w-4" />
          </Button>
        </form>

        {search.isFetching && <LoadingState label={`Looking up "${searchFor}" on SoFIFA…`} />}
        {search.isError && !search.isFetching && (
          <ErrorState message={search.error instanceof Error ? search.error.message : 'SoFIFA lookup failed.'} />
        )}

        {page && !search.isFetching && (
          <>
            {versionMismatch && (
              <p role="alert" className="flex items-start gap-2 border-2 border-yellow-400 bg-yellow-50 p-2.5 text-xs font-bold text-(--color-ink)">
                <AlertTriangle className="h-4 w-4 flex-none text-yellow-700" aria-hidden="true" />
                SoFIFA only has {page.version} data — this team is {team.version}, so it can't be updated from here.
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
                      <li key={candidate.sofifaId}>
                        <button
                          type="button"
                          onClick={() => setPickedId(candidate.sofifaId)}
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
                    SoFIFA: {source.name}
                  </span>
                  <span className="flex-none text-gray-500">
                    {page.version} · {page.rosterDate ?? 'latest'}
                  </span>
                </div>
                <table className="w-full border-2 border-(--color-ink) text-sm">
                  <thead>
                    <tr className="bg-(--color-ink) text-left text-[11px] uppercase tracking-wide text-white">
                      <th className="px-2 py-1.5 font-black"><span className="sr-only">Field</span></th>
                      <th className="px-2 py-1.5 font-black">Now</th>
                      <th className="px-2 py-1.5 font-black">SoFIFA</th>
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
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Already matches SoFIFA.
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
