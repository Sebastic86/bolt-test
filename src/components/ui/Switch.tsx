import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export const Switch: React.FC<SwitchProps> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className="relative h-6 w-11 flex-none rounded-full border-2 border-(--color-ink) transition-colors disabled:opacity-50"
    style={{ background: checked ? '#16a34a' : '#d1d5db' }}
  >
    <span
      className="absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all"
      style={{ left: checked ? '22px' : '2px' }}
    />
  </button>
);
