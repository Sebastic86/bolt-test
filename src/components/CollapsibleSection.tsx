import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  storageKey: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  badge?: string | number;
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
}) => {
  const [isOpen, setIsOpen] = useState(() => getInitialOpen(storageKey, defaultOpen));
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!contentRef.current) return;

    // Use ResizeObserver to dynamically track content height changes
    // This handles nested collapsibles (like PlayerAchievements cards)
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContentHeight(entry.target.scrollHeight);
      }
    });

    resizeObserver.observe(contentRef.current);

    // Initial height calculation
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
    <div className="w-full max-w-4xl mt-8">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between py-3 px-1 group cursor-pointer focus:outline-none"
        aria-expanded={isOpen}
      >
        <div className="flex items-center space-x-3">
          <h2 className="text-2xl font-semibold text-gray-700 group-hover:text-brand-dark transition-colors">
            {title}
          </h2>
          {badge !== undefined && badge !== '' && (
            <span className="text-sm font-medium bg-brand-light text-gray-700 px-2 py-0.5 rounded-full">
              {badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-6 h-6 text-gray-500 group-hover:text-brand-dark transition-transform duration-300 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{
          maxHeight: isOpen ? (contentHeight !== undefined ? `${contentHeight}px` : '5000px') : '0px',
          opacity: isOpen ? 1 : 0,
        }}
      >
        <div ref={contentRef}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;
