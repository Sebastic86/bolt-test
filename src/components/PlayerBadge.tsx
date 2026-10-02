import React from 'react';
import { User } from 'lucide-react';

interface PlayerBadgeProps {
  player: { id: string; name: string; avatar_url?: string | null };
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}

const SIZE_CLASSES: Record<'xs' | 'sm' | 'md', { avatar: string; icon: string; text: string; gap: string }> = {
  xs: { avatar: 'h-4 w-4', icon: 'h-2.5 w-2.5', text: 'text-[11px]', gap: 'gap-1' },
  sm: { avatar: 'h-5 w-5', icon: 'h-3 w-3', text: 'text-xs', gap: 'gap-1.5' },
  md: { avatar: 'h-7 w-7', icon: 'h-4 w-4', text: 'text-sm', gap: 'gap-2' },
};

/**
 * Compact avatar + name chip for player references inside stats views
 * (achievements, top teams, win matrix). Falls back to a user icon when the
 * player has no avatar_url — this app doesn't have an initials-based
 * fallback for players the way TeamBadge does for teams, since avatars are
 * user-uploaded photos rather than deterministically colorable names.
 */
export const PlayerBadge: React.FC<PlayerBadgeProps> = ({ player, size = 'sm', className = '' }) => {
  const sizes = SIZE_CLASSES[size];
  const [imgFailed, setImgFailed] = React.useState(false);

  return (
    <span className={`inline-flex min-w-0 items-center ${sizes.gap} ${className}`} title={player.name}>
      <span className={`flex flex-none items-center justify-center overflow-hidden border border-(--color-ink) bg-gray-100 ${sizes.avatar}`}>
        {player.avatar_url && !imgFailed ? (
          <img
            src={player.avatar_url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <User className={`${sizes.icon} text-gray-400`} />
        )}
      </span>
      <span className={`truncate font-bold text-(--color-ink) ${sizes.text}`}>{player.name}</span>
    </span>
  );
};

export default PlayerBadge;
