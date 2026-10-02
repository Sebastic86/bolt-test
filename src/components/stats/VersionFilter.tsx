import { useId } from 'react';
import { Select } from '../ui';
import { ALL_VERSIONS } from '../../utils/versionFilter';
import { SegmentedControl } from './SegmentedControl';

interface VersionFilterProps {
  versions: string[];
  value: string;
  onChange: (version: string) => void;
  className?: string;
}

/** Above this many versions a segmented control gets too cramped at 390px. */
const MAX_SEGMENTS = 4;

/**
 * "All / FC25 / FC26" version picker shared by every stats view. Renders a
 * segmented control for the usual handful of versions, falling back to the
 * Select primitive if the list ever grows too long for one row. Element ids
 * come from useId so several filters can live on the same page.
 */
export function VersionFilter({ versions, value, onChange, className = '' }: VersionFilterProps) {
  const selectId = useId();

  if (versions.length + 1 > MAX_SEGMENTS) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <label htmlFor={selectId} className="flex-none text-[10px] font-black uppercase tracking-wide text-gray-500">
          Version
        </label>
        <Select id={selectId} value={value} onChange={e => onChange(e.target.value)}>
          <option value={ALL_VERSIONS}>All Versions</option>
          {versions.map(v => <option key={v} value={v}>{v}</option>)}
        </Select>
      </div>
    );
  }

  return (
    <SegmentedControl
      label="Version"
      className={className}
      value={value}
      onChange={onChange}
      options={[{ value: ALL_VERSIONS, label: 'All' }, ...versions.map(v => ({ value: v, label: v }))]}
    />
  );
}

export default VersionFilter;
