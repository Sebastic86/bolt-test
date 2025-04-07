import React, { useState, useMemo, useEffect } from 'react';
import { Team } from '../types';
import { X, Dices } from 'lucide-react';

interface EditTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTeams: Team[];
  onTeamSelected: (team: Team) => void;
  currentTeam?: Team; // Optional: Pass the team being edited for context
}

const EditTeamModal: React.FC<EditTeamModalProps> = ({
  isOpen,
  onClose,
  allTeams,
  onTeamSelected,
  currentTeam,
}) => {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Reset state when modal opens or closes, or when the current team changes
  useEffect(() => {
    if (isOpen) {
      setSelectedLeague(currentTeam?.league || null);
      setSelectedTeamId(currentTeam?.id || null);
    } else {
      setSelectedLeague(null);
      setSelectedTeamId(null);
    }
  }, [isOpen, currentTeam]);

  // Memoize leagues list
  const leagues = useMemo(() => {
    const leagueSet = new Set<string>();
    allTeams.forEach(team => leagueSet.add(team.league));
    return Array.from(leagueSet).sort();
  }, [allTeams]);

  // Memoize teams filtered by selected league
  const teamsInSelectedLeague = useMemo(() => {
    if (!selectedLeague) return [];
    return allTeams
      .filter(team => team.league === selectedLeague)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTeams, selectedLeague]);

  const handleLeagueChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedLeague(event.target.value || null);
    setSelectedTeamId(null); // Reset team selection when league changes
  };

  const handleTeamChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeamId(event.target.value || null);
  };

  const handleSelectTeam = () => {
    if (selectedTeamId) {
      const team = allTeams.find(t => t.id === selectedTeamId);
      if (team) {
        onTeamSelected(team);
        onClose();
      }
    }
  };

  const handleRandomize = () => {
    if (allTeams.length > 0) {
      const randomIndex = Math.floor(Math.random() * allTeams.length);
      onTeamSelected(allTeams[randomIndex]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-semibold mb-4 text-gray-800">Edit Team</h2>

        {/* Randomize Button */}
        <button
          onClick={handleRandomize}
          className="w-full flex items-center justify-center px-4 py-2 mb-4 bg-purple-600 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
          disabled={allTeams.length === 0}
        >
          <Dices className="w-5 h-5 mr-2" />
          Select Random Team
        </button>

        <p className="text-center text-gray-500 mb-4">- OR -</p>

        {/* League Dropdown */}
        <div className="mb-4">
          <label htmlFor="league-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select League
          </label>
          <select
            id="league-select"
            value={selectedLeague || ''}
            onChange={handleLeagueChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          >
            <option value="">-- Select a League --</option>
            {leagues.map(league => (
              <option key={league} value={league}>
                {league}
              </option>
            ))}
          </select>
        </div>

        {/* Team Dropdown */}
        <div className="mb-6">
          <label htmlFor="team-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Team
          </label>
          <select
            id="team-select"
            value={selectedTeamId || ''}
            onChange={handleTeamChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            disabled={!selectedLeague || teamsInSelectedLeague.length === 0}
          >
            <option value="">-- Select a Team --</option>
            {teamsInSelectedLeague.map(team => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.overallRating})
              </option>
            ))}
          </select>
          {!selectedLeague && (
            <p className="text-xs text-gray-500 mt-1">Please select a league first.</p>
          )}
           {selectedLeague && teamsInSelectedLeague.length === 0 && (
            <p className="text-xs text-red-500 mt-1">No teams found for this league.</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSelectTeam}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            disabled={!selectedTeamId}
          >
            Select Team
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditTeamModal;
