import React, { useCallback, useMemo, useState } from 'react';
import { AlertTriangle, Moon, Share2, Ticket } from 'lucide-react';
import { useAppLayoutContext } from '../components/AppLayout';
import MatchList from '../components/MatchList';
import PlayerBadge from '../components/PlayerBadge';
import NightRecapSheet from '../components/night/NightRecapSheet';
import NightTable from '../components/night/NightTable';
import PastNights from '../components/night/PastNights';
import PredictionLeaderboard from '../components/night/PredictionLeaderboard';
import StartNightCard from '../components/night/StartNightCard';
import { BottomSheet, Button, Card, ErrorState, LoadingState } from '../components/ui';
import { useAuth } from '../contexts/AuthContext';
import {
  useActiveNightQuery, useEndNightMutation, useJokersQuery, useNightsQuery, usePredictionsQuery, useStartNightMutation,
} from '../queries/nights';
import { GameNight, MatchHistoryItem, Player, Prediction, Team } from '../types';
import { getLocalDateKey } from '../utils/matchDisplay';
import { calculateNightSummary, getJokersRemaining, getNightMatches, getNightNumber, getNightPlayers, isNightStale } from '../utils/nightStats';
import { calculatePredictionLeaderboard } from '../utils/predictionStats';
import {
  buildNightRecapData, formatGoalDifference, formatNightTitle, formatRecapDate, formatRecapTime,
} from '../utils/recapData';
import { getAvailableVersions } from '../utils/versionFilter';

const MIGRATION_HINT = 'If game nights are new, apply supabase/migrations/20261003090000_match_nights.sql to the database.';

const errorText = (error: unknown) => (error instanceof Error ? error.message : 'Unknown error');

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-1.5 text-xs font-black uppercase tracking-wide text-(--color-ink)">{children}</h2>;
}

export default function NightPage() {
  const { allMatches, players, teams, loadingAll, errorAll, filterSettings } = useAppLayoutContext();
  const { user, isAdmin, isNormalUser } = useAuth();
  const canEdit = isAdmin || isNormalUser;

  const activeQuery = useActiveNightQuery();
  const nightsQuery = useNightsQuery();
  const predictionsQuery = usePredictionsQuery(null, { allNights: true });
  const startMutation = useStartNightMutation();
  const endMutation = useEndNightMutation();

  // The night whose recap sheet is open — kept as an object so the recap of a
  // just-ended night survives the active-night query flipping to null.
  const [recapNight, setRecapNight] = useState<GameNight | null>(null);
  const closeRecap = useCallback(() => setRecapNight(null), []);

  const nights = useMemo(() => nightsQuery.data ?? [], [nightsQuery.data]);
  const predictions = useMemo(() => predictionsQuery.data ?? [], [predictionsQuery.data]);
  const versions = useMemo(() => getAvailableVersions(teams, allMatches), [teams, allMatches]);

  const recapData = useMemo(
    () => (recapNight ? buildNightRecapData(recapNight, { nights, allMatches, players, teams, predictions }) : null),
    [recapNight, nights, allMatches, players, teams, predictions]
  );

  const activeNight = activeQuery.data ?? null;

  let content: React.ReactNode;
  if (activeQuery.isLoading) {
    content = <LoadingState label="Loading game night..." />;
  } else if (activeQuery.error) {
    content = <ErrorState message={`Couldn't load game nights: ${errorText(activeQuery.error)}. ${MIGRATION_HINT}`} />;
  } else if (activeNight) {
    content = (
      <ActiveNight
        night={activeNight}
        nights={nights}
        allMatches={allMatches}
        players={players}
        teams={teams}
        predictions={predictions}
        predictionsError={predictionsQuery.error ? errorText(predictionsQuery.error) : null}
        canEdit={canEdit}
        currentUserId={user?.id}
        loadingMatches={loadingAll}
        matchesError={errorAll}
        onEnd={onDone => endMutation.mutate(activeNight.id, {
          onSuccess: ended => {
            onDone();
            setRecapNight(ended);
          },
        })}
        ending={endMutation.isPending}
        endError={endMutation.error ? errorText(endMutation.error) : null}
        onRecap={() => setRecapNight(activeNight)}
      />
    );
  } else {
    content = (
      <div className="space-y-5">
        <StartNightCard
          versions={versions}
          defaultVersion={filterSettings.selectedVersion}
          onStart={input => startMutation.mutate(input)}
          starting={startMutation.isPending}
          error={startMutation.error ? errorText(startMutation.error) : null}
          canStart={canEdit}
          players={players}
        />
        <section>
          <SectionTitle>Past nights</SectionTitle>
          {nightsQuery.isLoading && <LoadingState label="Loading nights..." />}
          {nightsQuery.error && <ErrorState message={`Couldn't load past nights: ${errorText(nightsQuery.error)}`} />}
          {nightsQuery.isSuccess && (
            <PastNights nights={nights} allMatches={allMatches} players={players} teams={teams} onOpen={setRecapNight} />
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md p-4">
      {content}
      <NightRecapSheet isOpen={recapNight !== null} onClose={closeRecap} data={recapData} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active night
// ---------------------------------------------------------------------------

interface ActiveNightProps {
  night: GameNight;
  nights: GameNight[];
  allMatches: MatchHistoryItem[];
  players: Player[];
  teams: Team[];
  predictions: Prediction[];
  predictionsError: string | null;
  canEdit: boolean;
  currentUserId?: string;
  loadingMatches: boolean;
  matchesError: string | null;
  /** Ends the night; calls onDone once it succeeded. */
  onEnd: (onDone: () => void) => void;
  ending: boolean;
  endError: string | null;
  onRecap: () => void;
}

/** "20:14", or "Fri 23/10/2026 20:14" when the night didn't start today. */
function formatSince(iso: string): string {
  const today = getLocalDateKey(new Date().toISOString());
  const time = formatRecapTime(iso);
  return getLocalDateKey(iso) === today ? time : `${formatRecapDate(iso)} ${time}`;
}

function ActiveNight({
  night, nights, allMatches, players, teams, predictions, predictionsError, canEdit, currentUserId,
  loadingMatches, matchesError, onEnd, ending, endError, onRecap,
}: ActiveNightProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const closeConfirm = useCallback(() => setConfirmOpen(false), []);
  const jokersQuery = useJokersQuery(night.id);

  const nightMatches = useMemo(() => getNightMatches(allMatches, night.id), [allMatches, night.id]);
  const newestFirst = useMemo(() => [...nightMatches].reverse(), [nightMatches]);
  const summary = useMemo(() => calculateNightSummary(nightMatches, players, teams), [nightMatches, players, teams]);

  const tonightLeaderboard = useMemo(
    () => calculatePredictionLeaderboard(predictions.filter(p => p.game_night_id === night.id), nightMatches, players),
    [predictions, night.id, nightMatches, players]
  );
  const seasonLeaderboard = useMemo(
    () => calculatePredictionLeaderboard(predictions, allMatches, players),
    [predictions, allMatches, players]
  );

  const jokersLeft = useMemo(
    () => getJokersRemaining(getNightPlayers(night, players), jokersQuery.data ?? [], night.jokers_per_player),
    [night, players, jokersQuery.data]
  );

  const title = formatNightTitle(night.version, getNightNumber(nights, night.id));
  // Evaluated on render; the page re-renders on every realtime match update anyway.
  const stale = isNightStale(night);
  const potn = summary.playerOfTheNight;

  const unscored = nightMatches.filter(m => m.team1_score === null || m.team2_score === null).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="border-b-[3px] border-(--color-green-bright) bg-(--color-ink) p-3 text-white">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-(--color-green-bright)">
              <span className="h-2 w-2 animate-pulse bg-(--color-green-bright)" aria-hidden />
              Live · since {formatSince(night.started_at)}
            </p>
            <h1 className="truncate text-xl font-black uppercase tracking-wide">{title}</h1>
          </div>
          <button
            type="button"
            onClick={onRecap}
            className="flex h-10 flex-none items-center gap-1.5 border-2 border-white px-3 text-xs font-bold uppercase tracking-wide"
          >
            <Share2 className="h-4 w-4" />
            Recap
          </button>
        </div>
        <p className="mt-1 text-xs text-gray-300 tabular-nums">
          {summary.matchCount} match{summary.matchCount === 1 ? '' : 'es'} · {summary.totalGoals} goals
          {unscored > 0 && ` · ${unscored} awaiting score`}
        </p>
      </div>

      {stale && (
        <div className="border-2 border-amber-600 bg-amber-50 p-3">
          <p className="flex items-start gap-2 text-sm font-bold text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            This night started more than 12 hours ago. Forgot to end it? New matches are still being added to it.
          </p>
          <Button variant="secondary" className="mt-2 h-12 w-full" disabled={!canEdit} onClick={() => setConfirmOpen(true)}>
            End night now
          </Button>
        </div>
      )}

      {/* Player of the night */}
      <section>
        <SectionTitle>{summary.playersOfTheNight.length > 1 ? 'Players of the night' : 'Player of the night'}</SectionTitle>
        <Card hard className="p-3">
          {potn ? (
            <>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {summary.playersOfTheNight.map(line => (
                  <PlayerBadge
                    key={line.playerId}
                    player={players.find(p => p.id === line.playerId) ?? { id: line.playerId, name: line.playerName }}
                    size="md"
                    className="max-w-full text-base uppercase tracking-wide"
                  />
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1.5">
                <Stat label="W-L" value={`${potn.wins}-${potn.losses}`} />
                <Stat label="Pts" value={potn.points} highlight />
                <Stat label="GD" value={formatGoalDifference(potn.goalDifference)} />
              </div>
            </>
          ) : (
            <p className="py-1 text-sm text-gray-500">Decided after the first scored match.</p>
          )}
        </Card>
      </section>

      {/* Live table */}
      <section>
        <SectionTitle>Live table</SectionTitle>
        {loadingMatches && nightMatches.length === 0 ? (
          <LoadingState label="Loading matches..." />
        ) : (
          <NightTable table={summary.table} players={players} />
        )}
      </section>

      {/* Jokers */}
      {night.jokers_per_player > 0 && (
        <section>
          <SectionTitle>Jokers left</SectionTitle>
          {jokersQuery.error ? (
            <ErrorState message={`Couldn't load jokers: ${errorText(jokersQuery.error)}`} />
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {getNightPlayers(night, players).map(player => {
                const left = jokersLeft.get(player.id) ?? 0;
                return (
                  <div
                    key={player.id}
                    className={`flex min-h-11 items-center justify-between gap-2 border-2 bg-white px-2 ${left > 0 ? 'border-(--color-ink)' : 'border-gray-300 opacity-60'}`}
                  >
                    <PlayerBadge player={player} size="sm" className="min-w-0 uppercase" />
                    <span className="flex flex-none items-center gap-1 text-sm font-black tabular-nums text-(--color-ink)">
                      <Ticket className={`h-4 w-4 ${left > 0 ? 'text-(--color-green-mid)' : 'text-gray-400'}`} />
                      {left}/{night.jokers_per_player}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Predictions */}
      <section>
        <SectionTitle>Predictions</SectionTitle>
        {predictionsError ? (
          <ErrorState message={`Couldn't load predictions: ${predictionsError}`} />
        ) : (
          <PredictionLeaderboard tonight={tonightLeaderboard} season={seasonLeaderboard} />
        )}
      </section>

      {/* Tonight's matches */}
      <section>
        <SectionTitle>Tonight's matches</SectionTitle>
        <MatchList
          matches={newestFirst}
          loading={loadingMatches}
          error={matchesError}
          players={players}
          currentUserId={currentUserId}
          timeOnly
          emptyMessage="No matches yet tonight — generate one with New Match."
        />
      </section>

      {canEdit && (
        <Button variant="outline" className="h-12 w-full" onClick={() => setConfirmOpen(true)}>
          <Moon className="h-4 w-4" />
          End night
        </Button>
      )}

      <BottomSheet
        isOpen={confirmOpen}
        onClose={closeConfirm}
        title="End game night?"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={ending}>Cancel</Button>
            <Button variant="secondary" onClick={() => onEnd(() => setConfirmOpen(false))} disabled={ending}>
              {ending ? 'Ending…' : 'End night'}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-(--color-ink)">
          {title} ends now with {summary.matchCount} match{summary.matchCount === 1 ? '' : 'es'}. New matches won't be added to it anymore.
        </p>
        {unscored > 0 && (
          <p className="mt-2 text-sm text-gray-600">
            {unscored} match{unscored === 1 ? ' has' : 'es have'} no score yet — scores entered later still count for this night.
          </p>
        )}
        {endError && <ErrorState className="mt-3" message={endError} />}
      </BottomSheet>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <div className="border border-gray-200 bg-gray-50 py-1.5 text-center">
      <div className={`text-lg font-black tabular-nums ${highlight ? 'text-(--color-green-mid)' : 'text-(--color-ink)'}`}>{value}</div>
      <div className="text-[10px] font-black uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}
