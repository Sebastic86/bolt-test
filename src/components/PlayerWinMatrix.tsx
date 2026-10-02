import React, { useMemo, useState } from 'react';
import { MatchHistoryItem, Player, Team } from '../types';
import {
  calculatePlayerPairStandings,
  getActivePlayers,
  indexPairStandings,
  pairKey,
  PlayerPairStanding,
} from '../utils/playerPairStatsUtils';
import { ALL_VERSIONS, filterMatchesByVersion, getAvailableVersions } from '../utils/versionFilter';
import PlayerBadge from './PlayerBadge';
import { SegmentedControl } from './stats/SegmentedControl';
import { VersionFilter } from './stats/VersionFilter';
import { LoadingState, ErrorState } from './ui';

interface PlayerWinMatrixProps {
  players: Player[];
  allMatches: MatchHistoryItem[];
  /** Used to derive the version filter options; falls back to the versions on the matches. */
  teams?: Team[];
  loading: boolean;
  error: string | null;
}

type View = 'list' | 'grid';

const colorClass = (winPercentage: number): string => {
  if (winPercentage >= 70) return 'text-(--color-green-mid)';
  if (winPercentage >= 50) return 'text-yellow-600';
  if (winPercentage >= 30) return 'text-orange-600';
  return 'text-red-600';
};

const LEGEND = [
  { swatch: 'bg-(--color-green-mid)', label: '≥70%' },
  { swatch: 'bg-yellow-600', label: '50–69%' },
  { swatch: 'bg-orange-600', label: '30–49%' },
  { swatch: 'bg-red-600', label: '<30%' },
];

function PairList({ pairs }: { pairs: PlayerPairStanding[] }) {
  return (
    <div className="space-y-2">
      {pairs.map(pair => (
        <div key={pairKey(pair.player1.id, pair.player2.id)} className="flex items-center gap-2 border-2 border-(--color-ink) bg-white p-2.5">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <PlayerBadge player={pair.player1} size="sm" />
              <span className="flex-none text-[10px] font-black text-gray-400">+</span>
              <PlayerBadge player={pair.player2} size="sm" />
            </div>
            <div className="mt-0.5 text-xs text-gray-500">
              {pair.wins}W-{pair.losses}L &middot; {pair.totalMatches} together
            </div>
          </div>
          <div className={`flex-none text-lg font-black tabular-nums ${colorClass(pair.winPercentage)}`}>
            {pair.winPercentage.toFixed(0)}%
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The old app's N×N matrix: rows and columns are players, each cell is the
 * pair's win % as teammates. Scrolls horizontally inside its own container
 * (never the page) with the player column pinned.
 */
function PairGrid({ players, pairs }: { players: Player[]; pairs: PlayerPairStanding[] }) {
  const index = useMemo(() => indexPairStandings(pairs), [pairs]);

  return (
    <div className="max-w-full overflow-x-auto border-2 border-(--color-ink) bg-white">
      <table className="border-separate border-spacing-0 text-xs">
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky left-0 z-20 border-r-2 border-b-2 border-(--color-ink) bg-white px-2 py-2 text-left text-[10px] font-black uppercase tracking-wide text-gray-500"
            >
              Player
            </th>
            {players.map(col => (
              <th key={col.id} scope="col" className="border-b-2 border-(--color-ink) bg-gray-50 px-1 py-2 align-bottom">
                <div className="mx-auto flex w-14 justify-center">
                  <PlayerBadge player={col} size="xs" className="max-w-full" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map(row => (
            <tr key={row.id}>
              <th
                scope="row"
                className="sticky left-0 z-10 border-r-2 border-b border-r-(--color-ink) border-b-gray-200 bg-white px-2 py-1 text-left font-normal"
              >
                <div className="w-24">
                  <PlayerBadge player={row} size="xs" className="max-w-full" />
                </div>
              </th>
              {players.map(col => {
                if (row.id === col.id) {
                  return (
                    <td key={col.id} className="h-11 min-w-14 border-b border-gray-200 bg-gray-100 text-center text-gray-400">
                      —
                    </td>
                  );
                }
                const stats = index.get(pairKey(row.id, col.id));
                if (!stats || stats.totalMatches === 0) {
                  return (
                    <td key={col.id} className="h-11 min-w-14 border-b border-gray-200 text-center text-gray-300">
                      —
                    </td>
                  );
                }
                return (
                  <td
                    key={col.id}
                    className="h-11 min-w-14 border-b border-gray-200 px-1 text-center"
                    title={`${stats.wins}W - ${stats.losses}L (${stats.totalMatches} matches)`}
                  >
                    <div className={`text-sm font-black tabular-nums ${colorClass(stats.winPercentage)}`}>
                      {stats.winPercentage.toFixed(0)}%
                    </div>
                    <div className="text-[9px] tabular-nums text-gray-500">{stats.wins}-{stats.losses}</div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Head-to-head "when these two are teammates" win record. Defaults to a
 * phone-friendly sorted list of pair cards; the "Grid" toggle restores the
 * old app's N×N matrix in a horizontally scrollable container.
 */
const PlayerWinMatrix: React.FC<PlayerWinMatrixProps> = ({ players, allMatches, teams, loading, error }) => {
  const [selectedVersion, setSelectedVersion] = useState(ALL_VERSIONS);
  const [view, setView] = useState<View>('list');

  const availableVersions = useMemo(() => getAvailableVersions(teams, allMatches), [teams, allMatches]);
  const filteredMatches = useMemo(
    () => filterMatchesByVersion(allMatches, selectedVersion),
    [allMatches, selectedVersion]
  );
  const pairs = useMemo(() => calculatePlayerPairStandings(players, filteredMatches), [players, filteredMatches]);
  const activePlayers = useMemo(() => getActivePlayers(players, filteredMatches), [players, filteredMatches]);

  return (
    <div>
      <div className="mb-2.5 space-y-2">
        {availableVersions.length > 0 && (
          <VersionFilter versions={availableVersions} value={selectedVersion} onChange={setSelectedVersion} />
        )}
        <SegmentedControl<View>
          label="View"
          value={view}
          onChange={setView}
          options={[{ value: 'list', label: 'List' }, { value: 'grid', label: 'Grid' }]}
        />
      </div>

      {loading && pairs.length === 0 && <LoadingState label="Calculating head-to-head stats..." />}
      {error && <ErrorState message={error} />}
      {!loading && !error && pairs.length === 0 && (
        <p className="py-4 text-center text-sm text-gray-500">
          {selectedVersion === ALL_VERSIONS
            ? 'No players have shared a team yet.'
            : `No players have shared a team in ${selectedVersion} yet.`}
        </p>
      )}

      {pairs.length > 0 && (view === 'list'
        ? <PairList pairs={pairs} />
        : <PairGrid players={activePlayers} pairs={pairs} />
      )}

      <div className="mt-2.5 space-y-1.5">
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1" aria-label="Win percentage colour scale">
          {LEGEND.map(item => (
            <span key={item.label} className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              <span className={`h-2.5 w-2.5 flex-none border border-(--color-ink) ${item.swatch}`} />
              {item.label}
            </span>
          ))}
        </div>
        <p className="text-center text-[10px] uppercase tracking-wide text-gray-400">
          Win % when both players are on the same team
          {view === 'grid' && <> &middot; cells show W-L &middot; scroll sideways for more players</>}
        </p>
      </div>
    </div>
  );
};

export default PlayerWinMatrix;
