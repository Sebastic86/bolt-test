import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (minRating: number, maxRating: number) => void;
  initialMinRating: number;
  initialMaxRating: number;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMinRating,
  initialMaxRating,
}) => {
  const [minRating, setMinRating] = useState<number>(initialMinRating);
  const [maxRating, setMaxRating] = useState<number>(initialMaxRating);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setMinRating(initialMinRating);
      setMaxRating(initialMaxRating);
      setError(null);
    }
  }, [isOpen, initialMinRating, initialMaxRating]);

  const handleSave = () => {
    const min = Number(minRating);
    const max = Number(maxRating);

    if (isNaN(min) || isNaN(max)) {
        setError("Ratings must be numbers.");
        return;
    }
    if (min < 0 || max < 0 || min > 5 || max > 5) {
      setError("Ratings must be between 0 and 5.");
      return;
    }
    if (min > max) {
      setError("Minimum rating cannot be greater than maximum rating.");
      return;
    }
    setError(null);
    onSave(min, max);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-sm relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-semibold mb-4 text-gray-800">Settings</h2>

        <p className="text-sm text-gray-600 mb-4">
          Filter teams by star rating (0.0 to 5.0).
        </p>

        {/* Min Rating Input */}
        <div className="mb-4">
          <label htmlFor="min-rating" className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Star Rating
          </label>
          <input
            type="number"
            id="min-rating"
            value={minRating}
            onChange={(e) => setMinRating(parseFloat(e.target.value) || 0)}
            min="0"
            max="5"
            step="0.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        {/* Max Rating Input */}
        <div className="mb-6">
          <label htmlFor="max-rating" className="block text-sm font-medium text-gray-700 mb-1">
            Maximum Star Rating
          </label>
          <input
            type="number"
            id="max-rating"
            value={maxRating}
            onChange={(e) => setMaxRating(parseFloat(e.target.value) || 0)}
            min="0"
            max="5"
            step="0.5"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        {/* Error Message */}
        {error && (
            <p className="text-xs text-red-600 mb-4">{error}</p>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
