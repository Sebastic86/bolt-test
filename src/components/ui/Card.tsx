import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Apply the signature hard offset shadow (hero elements only — team cards, the compare panel). */
  hard?: boolean;
}

export const Card: React.FC<CardProps> = ({ hard, className = '', children, ...rest }) => (
  <div
    className={`border-2 border-(--color-ink) bg-white ${hard ? 'shadow-hard' : ''} ${className}`}
    {...rest}
  >
    {children}
  </div>
);
