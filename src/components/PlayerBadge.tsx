import React from 'react';
import { Player } from '../types';
import { User } from 'lucide-react';

interface PlayerBadgeProps {
  player: Player | { id: string; name: string; avatar_url?: string | null };
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  showAvatar?: boolean; // Option to hide avatar if needed
}

const sizeClasses = {
  xs: {
    container: 'px-2 py-0.5 text-xs gap-1',
    avatar: 'w-4 h-4',
    icon: 'w-3 h-3',
  },
  sm: {
    container: 'px-2 py-1 text-sm gap-1.5',
    avatar: 'w-5 h-5',
    icon: 'w-3.5 h-3.5',
  },
  md: {
    container: 'px-3 py-1.5 text-base gap-2',
    avatar: 'w-6 h-6',
    icon: 'w-4 h-4',
  },
  lg: {
    container: 'px-4 py-2 text-lg gap-2',
    avatar: 'w-8 h-8',
    icon: 'w-5 h-5',
  },
};

/**
 * PlayerBadge Component - Displays player name with avatar in a rounded badge
 *
 * Features:
 * - Shows circular avatar with player name
 * - Falls back to user icon if no avatar
 * - Responsive sizing options
 * - Consistent styling across the app
 *
 * Usage:
 * ```tsx
 * <PlayerBadge player={player} size="sm" />
 * ```
 */
export const PlayerBadge: React.FC<PlayerBadgeProps> = ({
  player,
  size = 'sm',
  className = '',
  showAvatar = true,
}) => {
  const sizes = sizeClasses[size];

  return (
    <div
      className={`inline-flex items-center ${sizes.container} bg-gray-100 hover:bg-gray-200 rounded-full transition-colors ${className}`}
      title={player.name}
    >
      {showAvatar && (
        <div className={`${sizes.avatar} flex-shrink-0`}>
          {player.avatar_url ? (
            <img
              src={player.avatar_url}
              alt={player.name}
              className="w-full h-full rounded-full object-cover"
              onError={(e) => {
                // Fallback to icon on image load error
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const placeholder = target.nextElementSibling as HTMLDivElement;
                if (placeholder) {
                  placeholder.style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div
            className={`${sizes.avatar} ${
              player.avatar_url ? 'hidden' : 'flex'
            } items-center justify-center bg-gray-300 rounded-full text-gray-600`}
          >
            <User className={sizes.icon} />
          </div>
        </div>
      )}
      <span className="font-medium text-gray-800 truncate">{player.name}</span>
    </div>
  );
};

export default PlayerBadge;
