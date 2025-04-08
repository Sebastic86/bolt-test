import React, { useState, useEffect } from 'react';
import { X, Save, User, Edit3, Check, AlertCircle, RefreshCw } from 'lucide-react'; // Import RefreshCw
import { Player } from '../types'; // Import Player type

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (minRating: number, maxRating: number) => void;
  initialMinRating: number;
  initialMaxRating: number;
  allPlayers: Player[]; // Receive players
  onUpdatePlayerName: (playerId: string, newName: string) => Promise<boolean>; // Receive update handler
}

// Local state for managing player edits
interface EditingPlayerState {
  [playerId: string]: {
    currentName: string;
    isEditing: boolean;
    isLoading: boolean;
    error: string | null;
    success: boolean;
  };
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMinRating,
  initialMaxRating,
  allPlayers,
  onUpdatePlayerName,
}) => {
  const [minRating, setMinRating] = useState<number>(initialMinRating);
  const [maxRating, setMaxRating] = useState<number>(initialMaxRating);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [editingPlayers, setEditingPlayers] = useState<EditingPlayerState>({});

  // Initialize/Reset editing state when modal opens or players change
  useEffect(() => {
    if (isOpen) {
      console.log('[SettingsModal] Initializing state:', { initialMinRating, initialMaxRating });
      setMinRating(initialMinRating);
      setMaxRating(initialMaxRating);
      setRatingError(null);

      // Initialize editing state for each player
      const initialEditingState: EditingPlayerState = {};
      allPlayers.forEach(player => {
        initialEditingState[player.id] = {
          currentName: player.name,
          isEditing: false,
          isLoading: false,
          error: null,
          success: false,
        };
      });
      setEditingPlayers(initialEditingState);

    } else {
      // Clear state on close
      console.log('[SettingsModal] Closing, clearing state.');
      setEditingPlayers({});
    }
  }, [isOpen, initialMinRating, initialMaxRating, allPlayers]);

  const handleSaveRatings = () => {
    console.log('[SettingsModal] handleSaveRatings called.'); // DEBUG
    const min = Number(minRating);
    const max = Number(maxRating);
    console.log('[SettingsModal] Parsed ratings:', { min, max }); // DEBUG

    if (isNaN(min) || isNaN(max)) {
        console.log('[SettingsModal] Validation failed: Ratings are not numbers.'); // DEBUG
        setRatingError("Ratings must be numbers.");
        return;
    }
    if (min < 0 || max < 0 || min > 5 || max > 5) {
      console.log('[SettingsModal] Validation failed: Ratings out of range (0-5).'); // DEBUG
      setRatingError("Ratings must be between 0 and 5.");
      return;
    }
    if (min > max) {
      console.log('[SettingsModal] Validation failed: Min rating > Max rating.'); // DEBUG
      setRatingError("Minimum rating cannot be greater than maximum rating.");
      return;
    }

    console.log('[SettingsModal] Validation passed.'); // DEBUG
    setRatingError(null);

    try {
        console.log('[SettingsModal] Calling onSave...'); // DEBUG
        onSave(min, max);
        console.log('[SettingsModal] onSave finished.'); // DEBUG

        console.log('[SettingsModal] Calling onClose...'); // DEBUG
        onClose();
        console.log('[SettingsModal] onClose finished.'); // DEBUG
    } catch (e) {
        console.error('[SettingsModal] Error during onSave or onClose:', e); // DEBUG
    }
  };

  const handlePlayerNameChange = (playerId: string, newName: string) => {
    setEditingPlayers(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], currentName: newName, error: null, success: false }, // Clear error/success on change
    }));
  };

  const toggleEditPlayer = (playerId: string) => {
    setEditingPlayers(prev => {
      const current = prev[playerId];
      // Reset name to original if cancelling edit
      const resetName = !current.isEditing ? current.currentName : allPlayers.find(p => p.id === playerId)?.name || '';
      return {
        ...prev,
        [playerId]: {
          ...current,
          currentName: resetName, // Reset name if cancelling
          isEditing: !current.isEditing,
          error: null, // Clear error on toggle
          success: false, // Clear success on toggle
        },
      };
    });
  };

  const handleSavePlayerName = async (playerId: string) => {
    const playerState = editingPlayers[playerId];
    const originalPlayer = allPlayers.find(p => p.id === playerId);

    if (!playerState || !originalPlayer) return;

    const newName = playerState.currentName.trim();

    if (!newName) {
      setEditingPlayers(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], error: "Name cannot be empty." },
      }));
      return;
    }

    // Optional: Check if name already exists (case-insensitive)
    const nameExists = allPlayers.some(p => p.id !== playerId && p.name.toLowerCase() === newName.toLowerCase());
    if (nameExists) {
         setEditingPlayers(prev => ({
            ...prev,
            [playerId]: { ...prev[playerId], error: "Another player already has this name." },
         }));
         return;
    }


    // Set loading state
    setEditingPlayers(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], isLoading: true, error: null, success: false },
    }));

    const success = await onUpdatePlayerName(playerId, newName);

    // Update state based on success/failure
    setEditingPlayers(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        isLoading: false,
        isEditing: !success, // Keep editing if failed
        error: success ? null : "Failed to save name.",
        success: success,
      },
    }));

     // If successful, maybe flash success briefly?
     if (success) {
        setTimeout(() => {
            setEditingPlayers(prev => {
                // Check if player still exists in state before updating
                if (prev[playerId]) {
                    return {
                        ...prev,
                        [playerId]: { ...prev[playerId], success: false },
                    };
                }
                return prev; // Return previous state if player ID no longer exists
            });
        }, 2000); // Clear success message after 2 seconds
     }
  };


  if (!isOpen) return null;

  return (
    // Increase max-width to accommodate player list
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative my-8"> {/* Increased max-w */}
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-semibold mb-6 text-gray-800 text-center">Settings</h2>

        {/* --- Rating Filter Section --- */}
        <div className="mb-6 border-b pb-6">
            <h3 className="text-lg font-medium mb-3 text-gray-700">Team Rating Filter</h3>
            <p className="text-sm text-gray-600 mb-4">
            Filter teams by star rating (0.0 to 5.0).
            </p>
            <div className="flex flex-col sm:flex-row sm:space-x-4">
                {/* Min Rating Input */}
                <div className="mb-4 sm:mb-0 flex-1">
                <label htmlFor="min-rating" className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum
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
                <div className="flex-1">
                <label htmlFor="max-rating" className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum
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
            </div>
             {/* Rating Error Message */}
            {ratingError && (
                <p className="text-xs text-red-600 mt-2">{ratingError}</p>
            )}
             {/* Save Ratings Button */}
            <div className="flex justify-end mt-4">
                 <button
                    onClick={handleSaveRatings}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    <Save className="w-4 h-4 mr-2" />
                    Save Ratings & Close
                </button>
            </div>
        </div>


        {/* --- Manage Players Section --- */}
        <div className="mb-6">
            <h3 className="text-lg font-medium mb-3 text-gray-700">Manage Players</h3>
            {allPlayers.length === 0 ? (
                <p className="text-sm text-gray-500">No players found.</p>
            ) : (
                <ul className="space-y-3 max-h-60 overflow-y-auto pr-2"> {/* Added max-height and scroll */}
                    {allPlayers.map(player => {
                        const state = editingPlayers[player.id] || { currentName: player.name, isEditing: false, isLoading: false, error: null, success: false };
                        const originalName = player.name; // Keep original for comparison/reset

                        return (
                            <li key={player.id} className="flex items-center space-x-3 p-2 border rounded-md">
                                <User className="w-5 h-5 text-gray-500 flex-shrink-0" />
                                <div className="flex-grow min-w-0">
                                    {state.isEditing ? (
                                        <input
                                            type="text"
                                            value={state.currentName}
                                            onChange={(e) => handlePlayerNameChange(player.id, e.target.value)}
                                            className={`w-full px-2 py-1 border rounded-md text-sm ${state.error ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-1 focus:ring-indigo-500`}
                                            disabled={state.isLoading}
                                        />
                                    ) : (
                                        <span className="text-sm font-medium text-gray-800 truncate">{state.currentName}</span>
                                    )}
                                     {state.error && <p className="text-xs text-red-600 mt-1">{state.error}</p>}
                                     {state.success && <p className="text-xs text-green-600 mt-1 flex items-center"><Check className="w-3 h-3 mr-1"/> Saved!</p>}
                                </div>
                                <div className="flex-shrink-0 flex items-center space-x-1">
                                    {state.isEditing ? (
                                        <>
                                            <button
                                                onClick={() => handleSavePlayerName(player.id)}
                                                className="p-1 text-green-600 hover:text-green-800 disabled:opacity-50"
                                                disabled={state.isLoading || state.currentName.trim() === originalName || !state.currentName.trim()}
                                                title="Save Name"
                                            >
                                                {/* Correctly use RefreshCw here */}
                                                {state.isLoading ? <RefreshCw className="w-4 h-4 animate-spin"/> : <Save className="w-4 h-4" />}
                                            </button>
                                            <button
                                                onClick={() => toggleEditPlayer(player.id)}
                                                className="p-1 text-gray-500 hover:text-gray-700 disabled:opacity-50"
                                                disabled={state.isLoading}
                                                title="Cancel Edit"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            onClick={() => toggleEditPlayer(player.id)}
                                            className="p-1 text-blue-600 hover:text-blue-800"
                                            title="Edit Name"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>


        {/* Action Buttons (Overall Close) */}
        <div className="flex justify-end space-x-3 border-t pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Close
          </button>
          {/* Removed overall save button as saves are per section now */}
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
