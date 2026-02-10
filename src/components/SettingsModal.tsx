import React, { useState, useEffect } from 'react';
import { X, Save, User, Edit3, Check, RefreshCw, Upload, Trash } from 'lucide-react';
import { Player } from '../types';
import { supabase } from '../lib/supabaseClient';
import { AdminOnly } from './RoleBasedComponents';
import PlayerBadge from './PlayerBadge';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (minRating: number, maxRating: number, excludeNations: boolean, selectedVersion: string, maxOvrDiff: number) => void; // Updated signature
  initialMinRating: number;
  initialMaxRating: number;
  initialExcludeNations: boolean; // New prop
  initialSelectedVersion: string; // New prop for version
  initialMaxOvrDiff: number; // New prop for max OVR difference
  allPlayers: Player[];
  onUpdatePlayerName: (playerId: string, newName: string) => Promise<boolean>;
}

interface EditingPlayerState {
  [playerId: string]: {
    currentName: string;
    isEditing: boolean;
    isLoading: boolean;
    error: string | null;
    success: boolean;
    uploadingAvatar: boolean;
  };
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialMinRating,
  initialMaxRating,
  initialExcludeNations, // Use new prop
  initialSelectedVersion, // Use new version prop
  initialMaxOvrDiff, // Use new max OVR diff prop
  allPlayers,
  onUpdatePlayerName,
}) => {
  const [minRating, setMinRating] = useState<number>(initialMinRating);
  const [maxRating, setMaxRating] = useState<number>(initialMaxRating);
  const [excludeNations, setExcludeNations] = useState<boolean>(initialExcludeNations); // State for checkbox
  const [selectedVersion, setSelectedVersion] = useState<string>(initialSelectedVersion); // State for version
  const [maxOvrDiff, setMaxOvrDiff] = useState<number>(initialMaxOvrDiff); // State for max OVR difference
  const [availableVersions, setAvailableVersions] = useState<string[]>([]); // State for available versions
  const [versionsLoading, setVersionsLoading] = useState<boolean>(false); // Loading state for versions
  const [versionsError, setVersionsError] = useState<string | null>(null); // Error state for versions
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [editingPlayers, setEditingPlayers] = useState<EditingPlayerState>({});

  // Function to fetch available versions from database
  const fetchAvailableVersions = async () => {
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      console.log('[SettingsModal] Fetching available versions...');
      const { data, error } = await supabase
        .from('teams')
        .select('version')
        .order('version');
      
      if (error) {
        console.error('[SettingsModal] Error fetching versions:', error);
        throw new Error(`Failed to fetch versions: ${error.message}`);
      }
      
      // Extract unique versions
      const versions = Array.from(new Set(data?.map(item => item.version) || []));
      console.log('[SettingsModal] Available versions:', versions);
      setAvailableVersions(versions);
    } catch (error) {
      console.error('[SettingsModal] Error in fetchAvailableVersions:', error);
      setVersionsError(error instanceof Error ? error.message : 'Failed to fetch versions');
      // Fallback to default versions if fetch fails
      setAvailableVersions(['FC26']);
    } finally {
      setVersionsLoading(false);
    }
  };

  // Initialize/Reset editing state when modal opens or players change
  useEffect(() => {
    if (isOpen) {
      console.log('[SettingsModal] Initializing state:', { initialMinRating, initialMaxRating, initialExcludeNations, initialSelectedVersion, initialMaxOvrDiff });
      setMinRating(initialMinRating);
      setMaxRating(initialMaxRating);
      setExcludeNations(initialExcludeNations); // Initialize checkbox state
      setSelectedVersion(initialSelectedVersion); // Initialize version state
      setMaxOvrDiff(initialMaxOvrDiff); // Initialize max OVR diff state
      setRatingError(null);

      const initialEditingState: EditingPlayerState = {};
      allPlayers.forEach(player => {
        initialEditingState[player.id] = {
          currentName: player.name,
          isEditing: false,
          isLoading: false,
          error: null,
          uploadingAvatar: false,
          success: false,
        };
      });
      setEditingPlayers(initialEditingState);

      // Fetch available versions when modal opens
      fetchAvailableVersions();

    } else {
      console.log('[SettingsModal] Closing, clearing state.');
      setEditingPlayers({});
    }
  }, [isOpen, initialMinRating, initialMaxRating, initialExcludeNations, initialSelectedVersion, initialMaxOvrDiff, allPlayers]); // Add initialMaxOvrDiff dependency

  const handleSaveSettings = () => {
    console.log('[SettingsModal] handleSaveSettings called.');
    const min = Number(minRating);
    const max = Number(maxRating);
    console.log('[SettingsModal] Parsed ratings:', { min, max });

    if (isNaN(min) || isNaN(max)) {
        console.log('[SettingsModal] Validation failed: Ratings are not numbers.');
        setRatingError("Ratings must be numbers.");
        return;
    }
    if (min < 0 || max < 0 || min > 5 || max > 5) {
      console.log('[SettingsModal] Validation failed: Ratings out of range (0-5).');
      setRatingError("Ratings must be between 0 and 5.");
      return;
    }
    if (min > max) {
      console.log('[SettingsModal] Validation failed: Min rating > Max rating.');
      setRatingError("Minimum rating cannot be greater than maximum rating.");
      return;
    }

    console.log('[SettingsModal] Validation passed.');
    setRatingError(null);

    try {
        console.log('[SettingsModal] Calling onSave with excludeNations, selectedVersion, and maxOvrDiff:', excludeNations, selectedVersion, maxOvrDiff); // Log new values
        onSave(min, max, excludeNations, selectedVersion, maxOvrDiff); // Pass excludeNations, selectedVersion, and maxOvrDiff state
        console.log('[SettingsModal] onSave finished.');

        console.log('[SettingsModal] Calling onClose...');
        onClose();
        console.log('[SettingsModal] onClose finished.');
    } catch (e) {
        console.error('[SettingsModal] Error during onSave or onClose:', e);
    }
  };

  const handlePlayerNameChange = (playerId: string, newName: string) => {
    setEditingPlayers(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], currentName: newName, error: null, success: false },
    }));
  };

  const toggleEditPlayer = (playerId: string) => {
    setEditingPlayers(prev => {
      const current = prev[playerId];
      const resetName = !current.isEditing ? current.currentName : allPlayers.find(p => p.id === playerId)?.name || '';
      return {
        ...prev,
        [playerId]: {
          ...current,
          currentName: resetName,
          isEditing: !current.isEditing,
          error: null,
          success: false,
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

    const nameExists = allPlayers.some(p => p.id !== playerId && p.name.toLowerCase() === newName.toLowerCase());
    if (nameExists) {
         setEditingPlayers(prev => ({
            ...prev,
            [playerId]: { ...prev[playerId], error: "Another player already has this name." },
         }));
         return;
    }

    setEditingPlayers(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], isLoading: true, error: null, success: false },
    }));

    const success = await onUpdatePlayerName(playerId, newName);

    setEditingPlayers(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        isLoading: false,
        isEditing: !success,
        error: success ? null : "Failed to save name.",
        success: success,
      },
    }));

     if (success) {
        setTimeout(() => {
            setEditingPlayers(prev => {
                if (prev[playerId]) {
                    return {
                        ...prev,
                        [playerId]: { ...prev[playerId], success: false },
                    };
                }
                return prev;
            });
        }, 2000);
     }
  };

  const handleAvatarUpload = async (playerId: string, file: File) => {
    console.log(`[SettingsModal] Uploading avatar for player ${playerId}`);

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setEditingPlayers(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], error: 'Please select an image file' },
      }));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setEditingPlayers(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], error: 'File size must be less than 5MB' },
      }));
      return;
    }

    setEditingPlayers(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], uploadingAvatar: true, error: null },
    }));

    try {
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${playerId}-${Date.now()}.${fileExt}`;
      const filePath = `player-avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update player record with avatar URL
      const { error: updateError } = await supabase
        .from('players')
        .update({ avatar_url: publicUrl })
        .eq('id', playerId);

      if (updateError) throw updateError;

      console.log(`[SettingsModal] Avatar uploaded successfully for player ${playerId}`);

      setEditingPlayers(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], uploadingAvatar: false, success: true },
      }));

      // Trigger re-fetch of players to update UI
      window.location.reload(); // Simple refresh to update all player data
    } catch (error) {
      console.error('[SettingsModal] Error uploading avatar:', error);
      setEditingPlayers(prev => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          uploadingAvatar: false,
          error: 'Failed to upload avatar'
        },
      }));
    }
  };

  const handleRemoveAvatar = async (playerId: string) => {
    console.log(`[SettingsModal] Removing avatar for player ${playerId}`);

    setEditingPlayers(prev => ({
      ...prev,
      [playerId]: { ...prev[playerId], uploadingAvatar: true, error: null },
    }));

    try {
      // Update player record to remove avatar URL
      const { error: updateError } = await supabase
        .from('players')
        .update({ avatar_url: null })
        .eq('id', playerId);

      if (updateError) throw updateError;

      console.log(`[SettingsModal] Avatar removed successfully for player ${playerId}`);

      setEditingPlayers(prev => ({
        ...prev,
        [playerId]: { ...prev[playerId], uploadingAvatar: false, success: true },
      }));

      // Trigger re-fetch of players to update UI
      window.location.reload(); // Simple refresh to update all player data
    } catch (error) {
      console.error('[SettingsModal] Error removing avatar:', error);
      setEditingPlayers(prev => ({
        ...prev,
        [playerId]: {
          ...prev[playerId],
          uploadingAvatar: false,
          error: 'Failed to remove avatar'
        },
      }));
    }
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-full sm:max-w-lg relative my-4 sm:my-8 max-h-[95vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 sm:top-3 sm:right-3 text-gray-400 hover:text-gray-600 z-10"
          aria-label="Close modal"
        >
          <X className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 text-gray-800 text-center pr-8">Settings</h2>

        {/* --- Filter Section --- */}
        <div className="mb-4 sm:mb-6 border-b pb-4 sm:pb-6">
            <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3 text-gray-700">Team Filters</h3>

            {/* Rating Filter */}
            <div className="mb-3 sm:mb-4">
                <p className="text-xs sm:text-sm font-medium text-gray-700 mb-2">
                    Star Rating (0.0 to 5.0)
                </p>
                <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-2 sm:space-y-0">
                    <div className="flex-1">
                        <label htmlFor="min-rating" className="block text-xs font-medium text-gray-500 mb-1">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm"
                        />
                    </div>
                    <div className="flex-1">
                        <label htmlFor="max-rating" className="block text-xs font-medium text-gray-500 mb-1">
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
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm"
                        />
                    </div>
                </div>
                {ratingError && (
                    <p className="text-xs text-red-600 mt-2">{ratingError}</p>
                )}
            </div>

            {/* Version Selection Dropdown */}
            <div className="mb-4">
                <label htmlFor="version-select" className="block text-sm font-medium text-gray-700 mb-2">
                    Game Version
                </label>
                <select
                    id="version-select"
                    value={selectedVersion}
                    onChange={(e) => setSelectedVersion(e.target.value)}
                    disabled={versionsLoading}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {versionsLoading ? (
                        <option value="">Loading versions...</option>
                    ) : availableVersions.length > 0 ? (
                        availableVersions.map(version => (
                            <option key={version} value={version}>{version}</option>
                        ))
                    ) : (
                        <option value="">No versions available</option>
                    )}
                </select>
                {versionsError && (
                    <p className="text-xs text-red-600 mt-2">
                        Error loading versions: {versionsError}. Using fallback options.
                    </p>
                )}
            </div>

            {/* Max OVR Difference */}
            <div className="mb-4">
                <label htmlFor="max-ovr-diff" className="block text-sm font-medium text-gray-700 mb-2">
                    Max OVR Diff
                </label>
                <input
                    type="number"
                    id="max-ovr-diff"
                    value={maxOvrDiff}
                    onChange={(e) => setMaxOvrDiff(parseInt(e.target.value) || 0)}
                    min="0"
                    max="99"
                    step="1"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm"
                />
                <p className="text-xs text-gray-500 mt-1">
                    Maximum allowed OVR difference between teams when generating random matches
                </p>
            </div>

            {/* Exclude Nations Checkbox */}
            <div className="flex items-center">
                <input
                    id="exclude-nations"
                    name="exclude-nations"
                    type="checkbox"
                    checked={excludeNations}
                    onChange={(e) => setExcludeNations(e.target.checked)}
                    className="h-4 w-4 text-brand-dark focus:ring-brand-medium border-gray-300 rounded-sm"
                />
                <label htmlFor="exclude-nations" className="ml-2 block text-sm text-gray-900">
                    Exclude nation teams
                </label>
            </div>

             {/* Save Filters Button */}
            <div className="flex justify-end mt-4">
                 <button
                    onClick={handleSaveSettings} // Changed from handleSaveRatings
                    className="flex items-center px-3 sm:px-4 py-2 bg-brand-dark text-white rounded-md hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-brand-medium text-sm"
                >
                    <Save className="w-4 h-4 mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">Save Filters & Close</span>
                    <span className="sm:hidden">Save & Close</span>
                </button>
            </div>
        </div>


        <AdminOnly
          fallback={
            <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3 text-gray-700">Manage Players</h3>
              <p className="text-xs sm:text-sm text-gray-500">Admin access is required to manage players.</p>
            </div>
          }
        >
          {/* --- Manage Players Section --- */}
          <div className="mb-4 sm:mb-6">
              <h3 className="text-base sm:text-lg font-medium mb-2 sm:mb-3 text-gray-700">Manage Players</h3>
              {allPlayers.length === 0 ? (
                  <p className="text-xs sm:text-sm text-gray-500">No players found.</p>
              ) : (
                  <ul className="space-y-2 sm:space-y-3 max-h-96 overflow-y-auto pr-1 sm:pr-2">
                      {allPlayers.map(player => {
                          const state = editingPlayers[player.id] || { currentName: player.name, isEditing: false, isLoading: false, error: null, success: false, uploadingAvatar: false };
                          const originalName = player.name;

                          return (
                              <li key={player.id} className="flex flex-col space-y-2 p-3 border rounded-md bg-gray-50">
                                  <div className="flex items-center space-x-2 sm:space-x-3">
                                      {/* Avatar Display */}
                                      <div className="shrink-0">
                                          <PlayerBadge player={player} size="sm" />
                                      </div>

                                      <div className="grow min-w-0">
                                          {state.isEditing ? (
                                              <input
                                                  type="text"
                                                  value={state.currentName}
                                                  onChange={(e) => handlePlayerNameChange(player.id, e.target.value)}
                                                  className={`w-full px-2 py-1 border rounded-md text-xs sm:text-sm ${state.error ? 'border-red-500' : 'border-gray-300'} focus:outline-hidden focus:ring-1 focus:ring-brand-medium`}
                                                  disabled={state.isLoading}
                                              />
                                          ) : (
                                              <span className="text-xs sm:text-sm font-medium text-gray-800 truncate block">{state.currentName}</span>
                                          )}
                                      </div>

                                      <div className="shrink-0 flex items-center space-x-1">
                                          {state.isEditing ? (
                                              <>
                                                  <button
                                                      onClick={() => handleSavePlayerName(player.id)}
                                                      className="p-1 text-brand-dark hover:text-brand-medium disabled:opacity-50"
                                                      disabled={state.isLoading || state.currentName.trim() === originalName || !state.currentName.trim()}
                                                      title="Save Name"
                                                  >
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
                                  </div>

                                  {/* Avatar Upload Controls */}
                                  <div className="flex items-center space-x-2 pl-1">
                                      <label className="cursor-pointer">
                                          <input
                                              type="file"
                                              accept="image/*"
                                              className="hidden"
                                              onChange={(e) => {
                                                  const file = e.target.files?.[0];
                                                  if (file) handleAvatarUpload(player.id, file);
                                              }}
                                              disabled={state.uploadingAvatar}
                                          />
                                          <span className="inline-flex items-center px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50">
                                              {state.uploadingAvatar ? (
                                                  <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                              ) : (
                                                  <Upload className="w-3 h-3 mr-1" />
                                              )}
                                              {player.avatar_url ? 'Change Avatar' : 'Upload Avatar'}
                                          </span>
                                      </label>

                                      {player.avatar_url && (
                                          <button
                                              onClick={() => handleRemoveAvatar(player.id)}
                                              className="inline-flex items-center px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                                              disabled={state.uploadingAvatar}
                                              title="Remove Avatar"
                                          >
                                              <Trash className="w-3 h-3 mr-1" />
                                              Remove
                                          </button>
                                      )}
                                  </div>

                                  {state.error && <p className="text-xs text-red-600">{state.error}</p>}
                                  {state.success && <p className="text-xs text-green-600 flex items-center"><Check className="w-3 h-3 mr-1"/> Saved!</p>}
                              </li>
                          );
                      })}
                  </ul>
              )}
          </div>
        </AdminOnly>


        {/* Action Buttons (Overall Close) */}
        <div className="flex justify-end space-x-2 sm:space-x-3 border-t pt-3 sm:pt-4">
          <button
            onClick={onClose}
            className="px-3 sm:px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-hidden focus:ring-2 focus:ring-gray-400 text-sm"
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
