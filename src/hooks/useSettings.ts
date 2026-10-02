import { useState } from 'react';

const MIN_RATING_STORAGE_KEY = 'fcGeneratorMinRating';
const MAX_RATING_STORAGE_KEY = 'fcGeneratorMaxRating';
const EXCLUDE_NATIONS_STORAGE_KEY = 'fcGeneratorExcludeNations';
const SELECTED_VERSION_STORAGE_KEY = 'fcGeneratorSelectedVersion';
const MAX_OVR_DIFF_STORAGE_KEY = 'fcGeneratorMaxOvrDiff';
const SETTINGS_REVISION_KEY = 'fcGeneratorSettingsRev';

/**
 * Rev 2 (FC27 season): the version setting now means "follow the current
 * season" unless set explicitly. Older builds always saved a version (FC26),
 * so drop that once — every phone moves to the newest version.
 */
const SETTINGS_REVISION = 2;

function migrateStoredSettings() {
  try {
    if (Number(localStorage.getItem(SETTINGS_REVISION_KEY) ?? 0) < SETTINGS_REVISION) {
      localStorage.removeItem(SELECTED_VERSION_STORAGE_KEY);
      localStorage.setItem(SETTINGS_REVISION_KEY, String(SETTINGS_REVISION));
    }
  } catch (error) {
    console.error('Error migrating settings in localStorage:', error);
  }
}

/** Explicitly chosen version, or null = follow the current season (newest version). */
function getSavedVersion(): string | null {
  migrateStoredSettings();
  try {
    return localStorage.getItem(SELECTED_VERSION_STORAGE_KEY);
  } catch {
    return null;
  }
}

const getInitialRating = (key: string, defaultValue: number): number => {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 5) return parsed;
    }
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
  }
  return defaultValue;
};

const getInitialBoolean = (key: string, defaultValue: boolean): boolean => {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) return stored === 'true';
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
  }
  return defaultValue;
};

const getInitialInt = (key: string, defaultValue: number): number => {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
  }
  return defaultValue;
};

export function useSettings() {
  const [minRating, setMinRating] = useState<number>(() => getInitialRating(MIN_RATING_STORAGE_KEY, 4));
  const [maxRating, setMaxRating] = useState<number>(() => getInitialRating(MAX_RATING_STORAGE_KEY, 5));
  const [excludeNations, setExcludeNations] = useState<boolean>(() => getInitialBoolean(EXCLUDE_NATIONS_STORAGE_KEY, false));
  const [savedVersion, setSavedVersion] = useState<string | null>(getSavedVersion);
  const [maxOvrDiff, setMaxOvrDiff] = useState<number>(() => getInitialInt(MAX_OVR_DIFF_STORAGE_KEY, 5));
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  const handleOpenSettingsModal = () => setIsSettingsModalOpen(true);
  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false);

  const handleSaveSettings = (
    newMinRating: number,
    newMaxRating: number,
    newExcludeNations: boolean,
    /** null = follow the current season. */
    newSelectedVersion: string | null,
    newMaxOvrDiff: number
  ) => {
    setMinRating(newMinRating);
    setMaxRating(newMaxRating);
    setExcludeNations(newExcludeNations);
    setSavedVersion(newSelectedVersion);
    setMaxOvrDiff(newMaxOvrDiff);
    try {
      localStorage.setItem(MIN_RATING_STORAGE_KEY, newMinRating.toString());
      localStorage.setItem(MAX_RATING_STORAGE_KEY, newMaxRating.toString());
      localStorage.setItem(EXCLUDE_NATIONS_STORAGE_KEY, newExcludeNations.toString());
      if (newSelectedVersion === null) localStorage.removeItem(SELECTED_VERSION_STORAGE_KEY);
      else localStorage.setItem(SELECTED_VERSION_STORAGE_KEY, newSelectedVersion);
      localStorage.setItem(MAX_OVR_DIFF_STORAGE_KEY, newMaxOvrDiff.toString());
    } catch (error) {
      console.error('Error saving settings to localStorage:', error);
    }
  };

  return {
    minRating,
    maxRating,
    excludeNations,
    /** Explicit version choice; null = current season. Resolve with resolveSelectedVersion. */
    savedVersion,
    maxOvrDiff,
    isSettingsModalOpen,
    handleOpenSettingsModal,
    handleCloseSettingsModal,
    handleSaveSettings,
  };
}
