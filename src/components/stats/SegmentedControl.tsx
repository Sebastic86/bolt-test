import { useId } from 'react';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Visible label rendered before the control (e.g. "Version"). */
  label?: string;
  /** Accessible name when no visible label is given. */
  ariaLabel?: string;
  className?: string;
}

/**
 * Square-cornered segmented toggle in the Scoreboard Mono style. Each
 * segment is a >=40px-tall tap target; the whole control stretches to the
 * column width so it never causes horizontal scroll on a ~390px phone.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  ariaLabel,
  className = '',
}: SegmentedControlProps<T>) {
  const labelId = useId();

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {label && (
        <span id={labelId} className="flex-none text-[10px] font-black uppercase tracking-wide text-gray-500">
          {label}
        </span>
      )}
      <div
        role="radiogroup"
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : ariaLabel}
        className="flex min-w-0 flex-1 border-2 border-(--color-ink)"
      >
        {options.map((option, index) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(option.value)}
              className={`min-h-10 min-w-0 flex-1 truncate px-2 text-xs font-black uppercase tracking-wide ${
                index > 0 ? 'border-l-2 border-(--color-ink)' : ''
              } ${active ? 'bg-(--color-ink) text-white' : 'bg-white text-gray-600'}`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default SegmentedControl;
