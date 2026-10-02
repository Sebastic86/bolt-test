import React from 'react';

interface TeamBadgeProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-11 w-11 text-sm',
  lg: 'h-14 w-14 text-base',
};

// Deterministic color per team name so the same team always renders the
// same badge. This stands in for real crest artwork until the old app's
// external logo-resolution pipeline (TheSportsDB / API-Sports / Supabase
// Storage) is ported — deliberately deferred, not a missing feature bug.
const PALETTE = ['#a6272c', '#c8102e', '#5b6fa8', '#dc052d', '#6cabdd', '#1c1c1c', '#004170', '#ef0107', '#3f6212', '#7a5a1e'];

function colorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

function initialsForName(name: string): string {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
    .toUpperCase();
  return initials || '?';
}

export const TeamBadge: React.FC<TeamBadgeProps> = ({ name, size = 'md', className = '' }) => (
  <div
    className={`flex flex-none items-center justify-center border-2 border-(--color-ink) font-black text-white ${SIZE_CLASSES[size]} ${className}`}
    style={{ background: colorForName(name) }}
    title={name}
  >
    {initialsForName(name)}
  </div>
);
