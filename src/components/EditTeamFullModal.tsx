import React, { useState, useEffect } from 'react';
import { X, Save, Trash2, Download, Upload } from 'lucide-react';
import { Team } from '../types';
import { updateTeam, deleteTeam } from '../services/teamService';
import { uploadTeamLogo } from '../services/teamUploadService';
import { fetchTeamLogoFromApiSports } from '../services/apiSportsService';
import { TeamLogo } from './TeamLogo';

interface EditTeamFullModalProps {
  isOpen: boolean;
  onClose: () => void;
  team: Team;
  onTeamUpdated: () => void;
  onTeamDeleted: () => void;
}

const EditTeamFullModal: React.FC<EditTeamFullModalProps> = ({
  isOpen,
  onClose,
  team,
  onTeamUpdated,
  onTeamDeleted,
}) => {
  const [formData, setFormData] = useState<Team>(team);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [fetchingLogo, setFetchingLogo] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    setFormData(team);
    setError(null);
    setSuccess(null);
  }, [team]);

  if (!isOpen) return null;

  const handleInputChange = (field: keyof Team, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateTeam(team.id, formData);
      setSuccess('Team updated successfully!');
      onTeamUpdated();
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update team');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${team.name}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteTeam(team.id);
      onTeamDeleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete team');
    } finally {
      setDeleting(false);
    }
  };

  const handleFetchLogoFromApi = async () => {
    setFetchingLogo(true);
    setError(null);
    setSuccess(null);

    try {
      const logoUrl = await fetchTeamLogoFromApiSports(formData.apiTeamName || formData.name);

      if (logoUrl) {
        const updatedTeam = { ...formData, resolvedLogoUrl: logoUrl };
        await updateTeam(team.id, { resolvedLogoUrl: logoUrl });
        setFormData(updatedTeam);
        setSuccess('Logo fetched from API-Sports successfully!');
        onTeamUpdated();
      } else {
        setError('No logo found from API-Sports');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logo from API');
    } finally {
      setFetchingLogo(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploadingLogo(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await uploadTeamLogo(team.id, file);

      if (result.success && result.url) {
        const updatedTeam = { ...formData, resolvedLogoUrl: result.url };
        await updateTeam(team.id, { resolvedLogoUrl: result.url });
        setFormData(updatedTeam);
        setSuccess('Logo uploaded successfully!');
        onTeamUpdated();
      } else {
        setError(result.error || 'Failed to upload logo');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-brand-dark text-white px-6 py-4 flex justify-between items-center rounded-t-lg z-10">
          <h2 className="text-xl font-semibold">Edit Team</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-gray-200 transition"
            disabled={saving || deleting}
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-100 text-red-700 p-3 rounded-md text-sm">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-green-100 text-green-700 p-3 rounded-md text-sm">
              {success}
            </div>
          )}

          {/* Logo Section */}
          <div className="bg-brand-lighter border border-brand-light rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Team Logo</h3>
            <div className="flex flex-col md:flex-row items-center gap-4">
              <div className="shrink-0">
                <TeamLogo
                  team={{
                    name: formData.name,
                    logoUrl: formData.logoUrl,
                    apiTeamId: formData.apiTeamId,
                    apiTeamName: formData.apiTeamName,
                    resolvedLogoUrl: formData.resolvedLogoUrl,
                  }}
                  size="lg"
                />
              </div>
              <div className="flex-1 space-y-2 w-full">
                <button
                  onClick={handleFetchLogoFromApi}
                  disabled={fetchingLogo || uploadingLogo || saving}
                  className="w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {fetchingLogo ? (
                    <>
                      <Download className="w-4 h-4 mr-2 animate-pulse" />
                      Fetching...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 mr-2" />
                      Fetch from API-Sports
                    </>
                  )}
                </button>
                <label className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 cursor-pointer transition">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    onChange={handleFileUpload}
                    disabled={uploadingLogo || fetchingLogo || saving}
                    className="hidden"
                  />
                  {uploadingLogo ? (
                    <>
                      <Upload className="w-4 h-4 mr-2 animate-pulse" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 mr-2" />
                      Upload New Logo
                    </>
                  )}
                </label>
              </div>
            </div>
          </div>

          {/* Basic Information */}
          <div className="bg-brand-lighter border border-brand-light rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Basic Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">League</label>
              <input
                type="text"
                value={formData.league}
                onChange={(e) => handleInputChange('league', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version</label>
              <input
                type="text"
                value={formData.version}
                onChange={(e) => handleInputChange('version', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Star Rating (0.0 - 5.0)
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="5"
                value={formData.rating}
                onChange={(e) => handleInputChange('rating', parseFloat(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
              />
            </div>
          </div>

          {/* Ratings */}
          <div className="bg-brand-lighter border border-brand-light rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Team Ratings</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Overall Rating (0-99)
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={formData.overallRating}
                  onChange={(e) => handleInputChange('overallRating', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attack Rating (0-99)
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={formData.attackRating}
                  onChange={(e) => handleInputChange('attackRating', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Midfield Rating (0-99)
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={formData.midfieldRating}
                  onChange={(e) => handleInputChange('midfieldRating', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Defend Rating (0-99)
                </label>
                <input
                  type="number"
                  min="0"
                  max="99"
                  value={formData.defendRating}
                  onChange={(e) => handleInputChange('defendRating', parseInt(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
                />
              </div>
            </div>
          </div>

          {/* API Information */}
          <div className="bg-brand-lighter border border-brand-light rounded-lg p-4 space-y-3">
            <h3 className="text-lg font-semibold text-gray-800 mb-2">API Information</h3>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Team Name (for logo fetching)
              </label>
              <input
                type="text"
                value={formData.apiTeamName || ''}
                onChange={(e) => handleInputChange('apiTeamName', e.target.value)}
                placeholder="Leave empty to use team name"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-3 rounded-b-lg border-t border-gray-200">
          <button
            onClick={handleDelete}
            disabled={deleting || saving}
            className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {deleting ? (
              <>
                <Trash2 className="w-4 h-4 mr-2 animate-pulse" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Team
              </>
            )}
          </button>

          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <button
              onClick={onClose}
              disabled={saving || deleting}
              className="w-full sm:w-auto px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || deleting}
              className="w-full sm:w-auto flex items-center justify-center px-4 py-2 bg-brand-dark text-white rounded-md hover:bg-brand-medium disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {saving ? (
                <>
                  <Save className="w-4 h-4 mr-2 animate-pulse" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditTeamFullModal;
