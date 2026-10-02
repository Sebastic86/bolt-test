import React from 'react';

type Variant = 'primary' | 'secondary' | 'outline';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  // Bright green — the primary CTA color throughout the app.
  primary: 'bg-(--color-green-bright) text-(--color-ink) border-(--color-ink)',
  // Solid ink — secondary/neutral actions.
  secondary: 'bg-(--color-ink) text-white border-(--color-ink)',
  // White with an ink border — tertiary/cancel actions.
  outline: 'bg-white text-(--color-ink) border-(--color-ink)',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  className = '',
  children,
  ...rest
}) => (
  <button
    className={`inline-flex h-10 items-center justify-center gap-2 border-2 px-4 text-sm font-bold uppercase tracking-wide disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
    {...rest}
  >
    {children}
  </button>
);
