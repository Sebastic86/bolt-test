import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Maximize, Tv, Volleyball } from 'lucide-react';
import AuthWrapper from '../components/AuthWrapper';
import MatchRevealAnimation from '../components/MatchRevealAnimation';
import TvMatchup from '../components/tv/TvMatchup';
import { TvLatestResults, TvTable } from '../components/tv/TvSidePanel';
import { useMatchesRealtimeSync } from '../hooks/useMatchesRealtimeSync';
import { useTvMatchupSubscriber } from '../hooks/useTvSync';
import { useTeamsQuery } from '../queries/teams';
import { usePlayersQuery } from '../queries/players';
import { useAllMatchesQuery, useMatchesTodayQuery } from '../queries/matches';
import { useActiveNightQuery, useNightsQuery, usePredictionsQuery } from '../queries/nights';
import { Team } from '../types';
import { calculateNightSummary, getNightMatches, getNightNumber, getNightPlayers } from '../utils/nightStats';
import { getOpenPredictionsForMatchup } from '../utils/predictionStats';
import { allPlayersPicked } from '../utils/predictionPanelUtils';
import { getMatchupFromPredictions, resolveTvMatchup, TvMatchup as TvMatchupMessage } from '../utils/tvSync';

const LATEST_RESULTS = 4;

/** Scale the whole rem-based UI with the screen: ~14px on a laptop, ~18px on 1080p, ~28px on 4K. */
function useTvRootFontSize() {
  useEffect(() => {
    const root = document.documentElement;
    const previous = root.style.fontSize;
    root.style.fontSize = 'clamp(13px, 0.95vw, 28px)';
    return () => {
      root.style.fontSize = previous;
    };
  }, []);
}

/** Keep the TV/laptop screen from dimming while the page is open (where supported). */
function useWakeLock() {
  useEffect(() => {
    type Sentinel = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<Sentinel> } };
    if (!nav.wakeLock) return;
    let sentinel: Sentinel | null = null;
    let cancelled = false;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock!.request('screen').then(s => {
        if (cancelled) void s.release();
        else sentinel = s;
      }).catch(() => { /* denied or unsupported — not critical */ });
    };
    request();
    document.addEventListener('visibilitychange', request);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', request);
      void sentinel?.release();
    };
  }, []);
}

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);
  return now.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
}

function TvScreen() {
  useMatchesRealtimeSync();
  useWakeLock();
  const clock = useClock();

  const teamsQuery = useTeamsQuery();
  const playersQuery = usePlayersQuery();
  const allMatchesQuery = useAllMatchesQuery();
  const todayQuery = useMatchesTodayQuery();
  const activeNightQuery = useActiveNightQuery();
  const nightsQuery = useNightsQuery();

  const teams = useMemo(() => teamsQuery.data ?? [], [teamsQuery.data]);
  const players = useMemo(() => playersQuery.data ?? [], [playersQuery.data]);
  const allMatches = useMemo(() => allMatchesQuery.data ?? [], [allMatchesQuery.data]);
  const matchesToday = useMemo(() => todayQuery.data ?? [], [todayQuery.data]);
  const night = activeNightQuery.data ?? null;
  const predictionsQuery = usePredictionsQuery(night?.id ?? null);
  const predictions = useMemo(() => predictionsQuery.data ?? [], [predictionsQuery.data]);

  const nightNumber = night ? getNightNumber(nightsQuery.data ?? [], night.id) : null;
  const nightPlayers = useMemo(() => (night ? getNightPlayers(night, players) : []), [night, players]);

  // Outside a game night the TV shows today's matches instead.
  const sourceMatches = useMemo(
    () => (night ? getNightMatches(allMatches, night.id) : [...matchesToday].sort((a, b) => a.played_at.localeCompare(b.played_at))),
    [night, allMatches, matchesToday]
  );
  const summary = useMemo(() => calculateNightSummary(sourceMatches, players, teams), [sourceMatches, players, teams]);
  const latest = useMemo(() => [...sourceMatches].reverse().slice(0, LATEST_RESULTS), [sourceMatches]);

  // Current matchup: newest of what phones announced and tonight's newest open pick.
  const broadcast = useTvMatchupSubscriber();
  const fromPredictions = useMemo(() => getMatchupFromPredictions(predictions, night?.id ?? null), [predictions, night]);
  const current = resolveTvMatchup(broadcast, fromPredictions);

  const teamMap = useMemo(() => new Map(teams.map(t => [t.id, t])), [teams]);
  const toTeams = (m: TvMatchupMessage | null): [Team, Team] | null => {
    const t1 = m ? teamMap.get(m.team1Id) : undefined;
    const t2 = m ? teamMap.get(m.team2Id) : undefined;
    return t1 && t2 ? [t1, t2] : null;
  };
  const matchTeams = toTeams(current);

  // Play the reveal once per announcement, and let it finish even if the
  // phone's "committed" message arrives while it is still spinning.
  const seenReveals = useRef(new Set<string>());
  const [reveal, setReveal] = useState<[Team, Team] | null>(null);
  const revealKey = current?.reveal ? `${current.team1Id}|${current.team2Id}|${current.at}` : null;
  useEffect(() => {
    if (!revealKey || seenReveals.current.has(revealKey)) return;
    seenReveals.current.add(revealKey);
    const pair = toTeams(current);
    if (pair) setReveal(pair);
    // toTeams/current are derived from revealKey's inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealKey]);

  const revealPool = useMemo(() => {
    if (!reveal) return [];
    const isNation = reveal[0].league === 'Nation';
    return teams.filter(t => t.version === reveal[0].version && (t.league === 'Nation') === isNation);
  }, [reveal, teams]);

  const picks = useMemo(
    () => (night && matchTeams ? getOpenPredictionsForMatchup(predictions, night.id, matchTeams[0].id, matchTeams[1].id) : []),
    [night, matchTeams, predictions]
  );

  const loading = teamsQuery.isLoading || playersQuery.isLoading;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-(--color-ink) text-white">
      <header className="flex flex-none items-center gap-4 border-b-[3px] border-(--color-green-bright) px-8 py-3">
        <Volleyball className="h-7 w-7" aria-hidden="true" />
        <span className="text-xl font-black uppercase tracking-wider">EA FC Generator</span>
        {night ? (
          <span className="flex items-center gap-2 bg-(--color-green-bright) px-3 py-1 text-base font-black uppercase tracking-wide text-(--color-ink)">
            <span className="h-2.5 w-2.5 animate-pulse bg-(--color-ink)" aria-hidden="true" />
            {nightNumber ? `Night #${nightNumber}` : 'Game night'} · Live
          </span>
        ) : (
          <span className="border-2 border-gray-600 px-3 py-1 text-base font-black uppercase tracking-wide text-gray-400">Today</span>
        )}
        <span className="text-base font-bold uppercase tracking-wide text-gray-400">
          {summary.matchCount} {summary.matchCount === 1 ? 'match' : 'matches'} · {summary.totalGoals} goals
        </span>
        <span className="ml-auto text-3xl font-black tabular-nums">{clock}</span>
        <FullscreenButton />
        <Link to="/" className="flex h-10 items-center gap-1.5 border-2 border-gray-600 px-3 text-sm font-bold uppercase tracking-wide text-gray-300" aria-label="Exit TV mode">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Exit
        </Link>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-8 px-8 py-6">
        <section aria-label="Current matchup" className="min-h-0 overflow-hidden">
          {loading ? (
            <p className="flex h-full items-center justify-center text-2xl font-bold text-gray-500">Loading…</p>
          ) : reveal ? (
            <div className="mx-auto flex h-full max-w-xl flex-col justify-center text-(--color-ink)">
              <MatchRevealAnimation teams={reveal} allTeams={revealPool} onAnimationComplete={() => setReveal(null)} />
            </div>
          ) : matchTeams ? (
            <TvMatchup
              team1={matchTeams[0]}
              team2={matchTeams[1]}
              predictions={night ? { players: nightPlayers, picks, revealed: allPlayersPicked(nightPlayers, picks) } : undefined}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <Tv className="h-20 w-20 text-gray-600" aria-hidden="true" />
              <p className="text-4xl font-black uppercase tracking-wide">Waiting for the next matchup</p>
              <p className="text-xl text-gray-400">Tap <span className="font-black text-white">New Match</span> or <span className="font-black text-white">Pick &amp; Ban</span> on a phone.</p>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-6 overflow-hidden">
          <TvTable title={night ? 'Tonight' : 'Today'} table={summary.table} players={players} />
          <TvLatestResults matches={latest} />
        </aside>
      </main>
    </div>
  );
}

function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  if (isFullscreen || !document.documentElement.requestFullscreen) return null;
  return (
    <button
      type="button"
      onClick={() => void document.documentElement.requestFullscreen().catch(() => {})}
      className="flex h-10 items-center gap-1.5 border-2 border-white px-3 text-sm font-bold uppercase tracking-wide text-white"
    >
      <Maximize className="h-4 w-4" aria-hidden="true" />
      Fullscreen
    </button>
  );
}

export default function TvPage() {
  useTvRootFontSize();
  return (
    <AuthWrapper>
      <TvScreen />
    </AuthWrapper>
  );
}
