import { useState } from 'react';

// --- Constants for localStorage ---
const MIN_RATING_STORAGE_KEY = 'fcGeneratorMinRating';
const MAX_RATING_STORAGE_KEY = 'fcGeneratorMaxRating';
const EXCLUDE_NATIONS_STORAGE_KEY = 'fcGeneratorExcludeNations';
const SELECTED_VERSION_STORAGE_KEY = 'fcGeneratorSelectedVersion';
const MAX_OVR_DIFF_STORAGE_KEY = 'fcGeneratorMaxOvrDiff';

// --- Helper Functions for localStorage ---
const getInitialRating = (key: string, defaultValue: number): number => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue !== null) {
      const parsedValue = parseFloat(storedValue);
      if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= 5) {
        return parsedValue;
      }
    }
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
  }
  return defaultValue;
};

const getInitialBoolean = (key: string, defaultValue: boolean): boolean => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue !== null) {
      return storedValue === 'true';
    }
  } catch (error) {
    console.error(`Error reading ${key} from localStorage:`, error);
  }
  return defaultValue;
};

const getInitialString = (key: string, defaultValue: string): string => {
  try {
    const storedValue = localStorage.getItem(key);
    if (storedValue !== null) {
      return storedValue;
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
  const [selectedVersion, setSelectedVersion] = useState<string>(() => getInitialString(SELECTED_VERSION_STORAGE_KEY, 'FC26'));
  const [maxOvrDiff, setMaxOvrDiff] = useState<number>(() => {
    try {
      const storedValue = localStorage.getItem(MAX_OVR_DIFF_STORAGE_KEY);
      if (storedValue !== null) {
        const parsedValue = parseInt(storedValue);
        if (!isNaN(parsedValue) && parsedValue >= 0) {
          return parsedValue;
        }
      }
    } catch (error) {
      console.error(`Error reading ${MAX_OVR_DIFF_STORAGE_KEY} from localStorage:`, error);
    }
    return 5;
  });
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  const handleOpenSettingsModal = () => setIsSettingsModalOpen(true);
  const handleCloseSettingsModal = () => setIsSettingsModalOpen(false);

  const handleSaveSettings = (
    newMinRating: number,
    newMaxRating: number,
    newExcludeNations: boolean,
    newSelectedVersion: string,
    newMaxOvrDiff: number
  ) => {
    setMinRating(newMinRating);
    setMaxRating(newMaxRating);
    setExcludeNations(newExcludeNations);
    setSelectedVersion(newSelectedVersion);
    setMaxOvrDiff(newMaxOvrDiff);
    try {
      localStorage.setItem(MIN_RATING_STORAGE_KEY, newMinRating.toString());
      localStorage.setItem(MAX_RATING_STORAGE_KEY, newMaxRating.toString());
      localStorage.setItem(EXCLUDE_NATIONS_STORAGE_KEY, newExcludeNations.toString());
      localStorage.setItem(SELECTED_VERSION_STORAGE_KEY, newSelectedVersion);
      localStorage.setItem(MAX_OVR_DIFF_STORAGE_KEY, newMaxOvrDiff.toString());
    } catch (error) {
      console.error("Error saving settings to localStorage:", error);
    }
  };

  return {
    minRating,
    maxRating,
    excludeNations,
    selectedVersion,
    maxOvrDiff,
    isSettingsModalOpen,
    handleOpenSettingsModal,
    handleCloseSettingsModal,
    handleSaveSettings,
  };
}
