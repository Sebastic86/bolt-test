import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Team } from '../types';
import { Shield } from 'lucide-react';
import { getLogoPath } from '../utils/logoUtils';

interface MatchRevealAnimationProps {
  teams: [Team, Team];
  allTeams: Team[];
  onAnimationComplete: () => void;
}

type Phase = 'spinning' | 'landing-1' | 'landing-2' | 'complete';

const MatchRevealAnimation: React.FC<MatchRevealAnimationProps> = ({
  teams,
  allTeams,
  onAnimationComplete,
}) => {
  const [phase, setPhase] = useState<Phase>('spinning');
  const [displayTeam1, setDisplayTeam1] = useState<Team>(allTeams[0] || teams[0]);
  const [displayTeam2, setDisplayTeam2] = useState<Team>(allTeams[0] || teams[1]);
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());

  const interval1Ref = useRef<ReturnType<typeof setInterval> | null>(null);
  const interval2Ref = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLogoError = (teamId: string) => {
    setLogoErrors(prev => new Set(prev).add(teamId));
  };

  const getRandomTeam = useCallback(() => {
    if (allTeams.length === 0) return teams[0];
    return allTeams[Math.floor(Math.random() * allTeams.length)];
  }, [allTeams, teams]);

  useEffect(() => {
    // Phase 1: Both spinning fast
    interval1Ref.current = setInterval(() => {
      setDisplayTeam1(getRandomTeam());
    }, 80);
    interval2Ref.current = setInterval(() => {
      setDisplayTeam2(getRandomTeam());
    }, 80);

    // Phase 2: Slot 1 lands after 1.2s
    const timer1 = setTimeout(() => {
      setPhase('landing-1');
      if (interval1Ref.current) clearInterval(interval1Ref.current);

      // Slow down then stop
      let count = 0;
      const slowInterval = setInterval(() => {
        count++;
        if (count >= 4) {
          clearInterval(slowInterval);
          setDisplayTeam1(teams[0]);
        } else {
          setDisplayTeam1(getRandomTeam());
        }
      }, 200);
    }, 1200);

    // Phase 3: Slot 2 lands after 2.0s
    const timer2 = setTimeout(() => {
      setPhase('landing-2');
      if (interval2Ref.current) clearInterval(interval2Ref.current);

      let count = 0;
      const slowInterval = setInterval(() => {
        count++;
        if (count >= 4) {
          clearInterval(slowInterval);
          setDisplayTeam2(teams[1]);
        } else {
          setDisplayTeam2(getRandomTeam());
        }
      }, 200);
    }, 2000);

    // Phase 4: Complete after 3.2s
    const timerComplete = setTimeout(() => {
      setPhase('complete');
    }, 3200);

    return () => {
      if (interval1Ref.current) clearInterval(interval1Ref.current);
      if (interval2Ref.current) clearInterval(interval2Ref.current);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timerComplete);
    };
  }, [teams, getRandomTeam]);

  // Notify parent when animation is complete
  useEffect(() => {
    if (phase === 'complete') {
      const timer = setTimeout(onAnimationComplete, 600);
      return () => clearTimeout(timer);
    }
  }, [phase, onAnimationComplete]);

  const isLanded1 = phase === 'landing-1' || phase === 'landing-2' || phase === 'complete';
  const isLanded2 = phase === 'landing-2' || phase === 'complete';
  const isFullyLanded1 = displayTeam1.id === teams[0].id && isLanded1;
  const isFullyLanded2 = displayTeam2.id === teams[1].id && isLanded2;

  return (
    <div className="w-full max-w-4xl mb-6 mt-8">
      <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
        {/* Slot 1 */}
        <div
          className={`relative bg-white rounded-lg shadow-md p-6 w-full max-w-sm mx-auto border-2 transition-all duration-500 flex flex-col items-center justify-center min-h-[140px] ${
            isFullyLanded1
              ? 'border-brand-dark shadow-lg slot-land-animation glow-pulse-animation'
              : 'border-gray-200'
          } ${!isLanded1 ? 'slot-blur' : ''}`}
        >
          <div className="w-16 h-16 flex items-center justify-center overflow-hidden rounded-sm bg-gray-100 text-gray-400 mb-2">
            {logoErrors.has(displayTeam1.id) ? (
              <Shield className="w-10 h-10" />
            ) : (
              <img
                src={getLogoPath(displayTeam1.logoUrl)}
                alt={displayTeam1.name}
                className="w-full h-full object-contain"
                onError={() => handleLogoError(displayTeam1.id)}
              />
            )}
          </div>
          <p className={`text-lg font-semibold text-gray-800 text-center truncate max-w-full transition-opacity duration-300 ${
            isFullyLanded1 ? 'opacity-100' : 'opacity-70'
          }`}>
            {displayTeam1.name}
          </p>
          {isFullyLanded1 && (
            <p className="text-sm text-gray-500 mt-0.5">{displayTeam1.league}</p>
          )}
        </div>

        {/* VS */}
        <div className={`text-2xl font-bold transition-all duration-500 my-2 md:my-0 ${
          phase === 'complete' ? 'text-brand-dark scale-110' : 'text-gray-400'
        }`}>
          VS
        </div>

        {/* Slot 2 */}
        <div
          className={`relative bg-white rounded-lg shadow-md p-6 w-full max-w-sm mx-auto border-2 transition-all duration-500 flex flex-col items-center justify-center min-h-[140px] ${
            isFullyLanded2
              ? 'border-brand-dark shadow-lg slot-land-animation glow-pulse-animation'
              : 'border-gray-200'
          } ${!isLanded2 ? 'slot-blur' : ''}`}
        >
          <div className="w-16 h-16 flex items-center justify-center overflow-hidden rounded-sm bg-gray-100 text-gray-400 mb-2">
            {logoErrors.has(displayTeam2.id) ? (
              <Shield className="w-10 h-10" />
            ) : (
              <img
                src={getLogoPath(displayTeam2.logoUrl)}
                alt={displayTeam2.name}
                className="w-full h-full object-contain"
                onError={() => handleLogoError(displayTeam2.id)}
              />
            )}
          </div>
          <p className={`text-lg font-semibold text-gray-800 text-center truncate max-w-full transition-opacity duration-300 ${
            isFullyLanded2 ? 'opacity-100' : 'opacity-70'
          }`}>
            {displayTeam2.name}
          </p>
          {isFullyLanded2 && (
            <p className="text-sm text-gray-500 mt-0.5">{displayTeam2.league}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchRevealAnimation;
