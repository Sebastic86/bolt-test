import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
  /** Wrapper className override — defaults to a full-width block, no max-width. */
  className?: string;
}

const getInitialOpen = (storageKey: string, defaultOpen: boolean): boolean => {
  try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
      return stored === 'true';
    }
  } catch {
    // localStorage unavailable
  }
  return defaultOpen;
};

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({
  title,
  storageKey,
  defaultOpen = true,
  children,
  badge,
  className = 'w-full',
}) => {
  const [isOpen, setIsOpen] = useState(() => getInitialOpen(storageKey, defaultOpen));
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!contentRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(entry.target.scrollHeight);
      }
    });

    resizeObserver.observe(contentRef.current);
    setContentHeight(contentRef.current.scrollHeight);

    return () => {
      resizeObserver.disconnect();
    };
  }, [children, isOpen]);

  const handleToggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    try {
      localStorage.setItem(storageKey, next.toString());
    } catch {
      // localStorage unavailable
    }
  };

  return (
    <div className={className}>
      <button
        onClick={handleToggle}
        className="flex w-full items-center justify-between py-3 focus:outline-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-base font-black uppercase tracking-wide text-(--color-ink)">
            {title}
          </h2>
          {badge !== undefined && badge !== '' && (
            <span className="border border-(--color-ink) bg-(--color-green-bright)/20 px-2 py-0.5 text-xs font-bold text-(--color-ink)">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-5 w-5 text-(--color-ink) transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? (contentHeight !== undefined ? `${contentHeight}px` : '5000px') : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
