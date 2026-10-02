import React, { useEffect, useRef, useState } from 'react';
import { Team } from '../types';
import { TeamLogo } from './TeamLogo';
import { Card } from './ui';

interface MatchRevealAnimationProps {
  teams: [Team, Team];
  /** Pool the slots cycle through while spinning — pass the FILTERED teams, so the spin only shows plausible picks. */
  allTeams: Team[];
  onAnimationComplete: () => void;
}

type Phase = 'spinning' | 'landing-1' | 'landing-2' | 'complete';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Slot-machine reveal for a freshly-generated matchup: both slots cycle
 * through random teams, slot 1 slows and locks onto the real team1 first,
 * then slot 2 does the same for team2. Stacked vertically (not old app's
 * side-by-side) to match this app's mobile-first matchup layout.
 *
 * With prefers-reduced-motion the slots show the final teams straight away
 * and the reveal completes after a short pause — no cycling.
 */
const MatchRevealAnimation: React.FC<MatchRevealAnimationProps> = ({ teams, allTeams, onAnimationComplete }) => {
  const [reducedMotion] = useState(prefersReducedMotion);
  const [phase, setPhase] = useState<Phase>(reducedMotion ? 'complete' : 'spinning');
  const [displayTeam1, setDisplayTeam1] = useState<Team>(reducedMotion ? teams[0] : (allTeams[0] ?? teams[0]));
  const [displayTeam2, setDisplayTeam2] = useState<Team>(reducedMotion ? teams[1] : (allTeams[0] ?? teams[1]));

  // Refs so the timer effect below can stay keyed to the target matchup
  // only, yet always read the latest pool/callback.
  const poolRef = useRef(allTeams);
  const onAnimationCompleteRef = useRef(onAnimationComplete);
  useEffect(() => {
    poolRef.current = allTeams;
    onAnimationCompleteRef.current = onAnimationComplete;
  });

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const intervals = new Set<ReturnType<typeof setInterval>>();
    const after = (ms: number, fn: () => void) => {
      const id = setTimeout(() => { timers.delete(id); fn(); }, ms);
      timers.add(id);
    };
    const every = (ms: number, fn: () => void) => {
      const id = setInterval(fn, ms);
      intervals.add(id);
      return () => { clearInterval(id); intervals.delete(id); };
    };
    const randomTeam = (fallback: Team) => {
      const pool = poolRef.current;
      return pool.length === 0 ? fallback : pool[Math.floor(Math.random() * pool.length)];
    };

    if (reducedMotion) {
      after(600, () => onAnimationCompleteRef.current());
    } else {
      const stopSpin1 = every(80, () => setDisplayTeam1(randomTeam(teams[0])));
      const stopSpin2 = every(80, () => setDisplayTeam2(randomTeam(teams[1])));

      const land = (stopSpin: () => void, setDisplay: (t: Team) => void, target: Team) => {
        stopSpin();
        let count = 0;
        const stopSlow = every(200, () => {
          count++;
          if (count >= 4) {
            stopSlow();
            setDisplay(target);
          } else {
            setDisplay(randomTeam(target));
          }
        });
      };

      after(1200, () => { setPhase('landing-1'); land(stopSpin1, setDisplayTeam1, teams[0]); });
      after(2000, () => { setPhase('landing-2'); land(stopSpin2, setDisplayTeam2, teams[1]); });
      after(3200, () => setPhase('complete'));
      after(3800, () => onAnimationCompleteRef.current());
    }

    // Every pending timeout and interval — including the "slow down"
    // intervals created mid-sequence — is cleared on unmount.
    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
      timers.clear();
      intervals.clear();
    };
  }, [teams, reducedMotion]);

  const isLanded1 = phase !== 'spinning';
  const isLanded2 = phase === 'landing-2' || phase === 'complete';
  const isSettled1 = isLanded1 && displayTeam1.id === teams[0].id;
  const isSettled2 = isLanded2 && displayTeam2.id === teams[1].id;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-3">
      <RevealSlot team={displayTeam1} settled={isSettled1} spinning={!isLanded1} />

      <div className="flex items-center gap-2.5">
        <div className="h-0.5 flex-1 bg-(--color-ink)" />
        <div className={`flex h-9 w-9 flex-none items-center justify-center border-2 border-(--color-ink) text-xs font-black text-(--color-ink) transition-colors duration-300 ${phase === 'complete' ? 'bg-(--color-green-bright)' : 'bg-gray-200'}`}>
          VS
        </div>
        <div className="h-0.5 flex-1 bg-(--color-ink)" />
      </div>

      <RevealSlot team={displayTeam2} settled={isSettled2} spinning={!isLanded2} />
    </div>
  );
};

const RevealSlot: React.FC<{ team: Team; settled: boolean; spinning: boolean }> = ({ team, settled, spinning }) => (
  <Card
    hard={settled}
    className={`flex min-h-[104px] flex-col items-center justify-center gap-1.5 p-4 transition-opacity duration-150 ${spinning ? 'opacity-60 blur-[1px]' : 'opacity-100'} ${settled ? 'animate-reveal-land animate-reveal-glow' : ''}`}
  >
    {/* While cycling, crest data only (no ids/API names) so flicking through
        the pool every 80ms never fires logo API lookups; the settled team
        gets full resolution. */}
    <TeamLogo
      team={settled ? team : { name: team.name, resolvedLogoUrl: team.resolvedLogoUrl, logoUrl: team.logoUrl }}
      size="lg"
    />
    <span className="max-w-full truncate text-center text-sm font-black uppercase tracking-wide text-(--color-ink)">
      {team.name}
    </span>
    {settled && <span className="text-xs font-semibold text-gray-500">{team.league}</span>}
  </Card>
);

export default MatchRevealAnimation;
