import React from 'react';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className = '', ...rest }, ref) => (
    <input
      ref={ref}
      className={`h-10 w-full border-2 border-(--color-ink) px-3 text-base text-(--color-ink) focus:outline-none focus:ring-2 focus:ring-(--color-green-bright) sm:text-sm disabled:opacity-50 ${className}`}
      {...rest}
    />
  )
);
Input.displayName = 'Input';
