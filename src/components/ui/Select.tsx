import React from 'react';

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <select
      ref={ref}
      className={`h-10 w-full border-2 border-(--color-ink) bg-white px-3 text-base text-(--color-ink) focus:outline-none focus:ring-2 focus:ring-(--color-green-bright) sm:text-sm disabled:opacity-50 ${className}`}
      {...rest}
    >
      {children}
    </select>
  )
);
Select.displayName = 'Select';
