import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Team } from '../types';
import { TeamLogo } from './TeamLogo';
import { Card } from './ui';

interface MatchRevealAnimationProps {
  teams: [Team, Team];
  allTeams: Team[];
  onAnimationComplete: () => void;
}

type Phase = 'spinning' | 'landing-1' | 'landing-2' | 'complete';

/**
 * Slot-machine reveal for a freshly-generated matchup: both slots cycle
 * through random teams, slot 1 slows and locks onto the real team1 first,
 * then slot 2 does the same for team2. Stacked vertically (not old app's
 * side-by-side) to match this app's mobile-first matchup layout.
 */
const MatchRevealAnimation: React.FC<MatchRevealAnimationProps> = ({ teams, allTeams, onAnimationComplete }) => {
  const [phase, setPhase] = useState<Phase>('spinning');
  const [displayTeam1, setDisplayTeam1] = useState<Team>(allTeams[0] ?? teams[0]);
  const [displayTeam2, setDisplayTeam2] = useState<Team>(allTeams[0] ?? teams[1]);

  const getRandomTeam = useCallback(() => {
    if (allTeams.length === 0) return teams[0];
    return allTeams[Math.floor(Math.random() * allTeams.length)];
  }, [allTeams, teams]);

  const onAnimationCompleteRef = useRef(onAnimationComplete);
  onAnimationCompleteRef.current = onAnimationComplete;

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    const intervals: ReturnType<typeof setInterval>[] = [];

    const spin1 = setInterval(() => setDisplayTeam1(getRandomTeam()), 80);
    const spin2 = setInterval(() => setDisplayTeam2(getRandomTeam()), 80);
    intervals.push(spin1, spin2);

    timers.push(setTimeout(() => {
      setPhase('landing-1');
      clearInterval(spin1);
      let count = 0;
      const slow = setInterval(() => {
        count++;
        if (count >= 4) {
          clearInterval(slow);
          setDisplayTeam1(teams[0]);
        } else {
          setDisplayTeam1(getRandomTeam());
        }
      }, 200);
      intervals.push(slow);
    }, 1200));

    timers.push(setTimeout(() => {
      setPhase('landing-2');
      clearInterval(spin2);
      let count = 0;
      const slow = setInterval(() => {
        count++;
        if (count >= 4) {
          clearInterval(slow);
          setDisplayTeam2(teams[1]);
        } else {
          setDisplayTeam2(getRandomTeam());
        }
      }, 200);
      intervals.push(slow);
    }, 2000));

    timers.push(setTimeout(() => setPhase('complete'), 3200));
    timers.push(setTimeout(() => onAnimationCompleteRef.current(), 3800));

    return () => {
      timers.forEach(clearTimeout);
      intervals.forEach(clearInterval);
    };
    // Deliberately keyed only to the target matchup — re-running this effect
    // on every getRandomTeam identity change would restart the whole sequence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

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
    <TeamLogo team={team} size="lg" />
    <span className="max-w-full truncate text-center text-sm font-black uppercase tracking-wide text-(--color-ink)">
      {team.name}
    </span>
    {settled && <span className="text-xs font-semibold text-gray-500">{team.league}</span>}
  </Card>
);

export default MatchRevealAnimation;
