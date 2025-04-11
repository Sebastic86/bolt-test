import React, { useState, useMemo, useEffect } from 'react';
import { Team } from '../types';
import { X, Dices } from 'lucide-react';

interface EditTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  allTeams: Team[]; // Now receives potentially pre-filtered teams
  onTeamSelected: (team: Team) => void;
  currentTeam?: Team;
}

const EditTeamModal: React.FC<EditTeamModalProps> = ({
  isOpen,
  onClose,
  allTeams, // Use the passed (filtered) teams
  onTeamSelected,
  currentTeam,
}) => {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Reset state when modal opens/closes or available teams change
  useEffect(() => {
    if (isOpen) {
      // Try to keep selection if possible within the new filtered list
      const currentLeagueStillAvailable = currentTeam && allTeams.some(t => t.league === currentTeam.league);
      const currentTeamStillAvailable = currentTeam && allTeams.some(t => t.id === currentTeam.id);

      setSelectedLeague(currentLeagueStillAvailable ? currentTeam.league : null);
      setSelectedTeamId(currentTeamStillAvailable ? currentTeam.id : null);

      // If league is set but team isn't (because it was filtered out), reset team
      if (selectedLeague && !selectedTeamId) {
         setSelectedTeamId(null);
      }

    } else {
      setSelectedLeague(null);
      setSelectedTeamId(null);
    }
  }, [isOpen, currentTeam, allTeams]); // Add allTeams dependency

  // Memoize leagues based on the *currently available* (filtered) teams
  const leagues = useMemo(() => {
    const leagueSet = new Set<string>();
    allTeams.forEach(team => leagueSet.add(team.league));
    return Array.from(leagueSet).sort();
  }, [allTeams]); // Recalculate if allTeams changes

  // Memoize teams filtered by selected league from the *currently available* list
  const teamsInSelectedLeague = useMemo(() => {
    if (!selectedLeague) return [];
    return allTeams // Filter from the already filtered list passed as prop
      .filter(team => team.league === selectedLeague)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allTeams, selectedLeague]); // Recalculate if allTeams or selectedLeague changes

  const handleLeagueChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newLeague = event.target.value || null;
    setSelectedLeague(newLeague);
    // Reset team only if the new league is different or null
    if (newLeague !== selectedLeague) {
        setSelectedTeamId(null);
    }
  };

  const handleTeamChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedTeamId(event.target.value || null);
  };

  const handleSelectTeam = () => {
    if (selectedTeamId) {
      const team = allTeams.find(t => t.id === selectedTeamId);
      if (team) {
        onTeamSelected(team);
        // onClose(); // Keep modal open until Cancel or X is clicked? Or close on select? Closing for now.
      }
    }
  };

  const handleRandomize = () => {
    // Randomize from the *currently available* (filtered) list
    if (allTeams.length > 0) {
      const randomIndex = Math.floor(Math.random() * allTeams.length);
      onTeamSelected(allTeams[randomIndex]);
      // onClose(); // Closing for now.
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
          aria-label="Close modal"
        >
          <X className="w-6 h-6" />
        </button>

        <h2 className="text-xl font-semibold mb-4 text-gray-800">
          Edit Team {currentTeam ? `(${currentTeam.name})` : ''}
        </h2>

        <button
          onClick={handleRandomize}
          className="w-full flex items-center justify-center px-4 py-2 mb-4 bg-brand-medium text-white font-semibold rounded-lg shadow-md hover:bg-brand-dark focus:outline-hidden focus:ring-2 focus:ring-brand-medium focus:ring-opacity-50 transition duration-150 ease-in-out"
          disabled={allTeams.length === 0}
        >
          <Dices className="w-5 h-5 mr-2" />
          Select Random Team (from current filter)
        </button>

        <p className="text-center text-gray-500 mb-4">- OR -</p>

        <div className="mb-4">
          <label htmlFor="league-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select League (from current filter)
          </label>
          <select
            id="league-select"
            value={selectedLeague || ''}
            onChange={handleLeagueChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm"
            disabled={leagues.length === 0}
          >
            <option value="">-- Select a League --</option>
            {leagues.map(league => (
              <option key={league} value={league}>
                {league}
              </option>
            ))}
          </select>
           {leagues.length === 0 && allTeams.length > 0 && (
             <p className="text-xs text-yellow-600 mt-1">No leagues available in the current star rating filter.</p>
           )}
        </div>

        <div className="mb-6">
          <label htmlFor="team-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Team
          </label>
          <select
            id="team-select"
            value={selectedTeamId || ''}
            onChange={handleTeamChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-xs focus:outline-hidden focus:ring-brand-medium focus:border-brand-medium sm:text-sm"
            disabled={!selectedLeague || teamsInSelectedLeague.length === 0}
          >
            <option value="">-- Select a Team --</option>
            {teamsInSelectedLeague.map(team => (
              <option key={team.id} value={team.id}>
                {team.name} ({team.overallRating})
              </option>
            ))}
          </select>
          {!selectedLeague && leagues.length > 0 && (
            <p className="text-xs text-gray-500 mt-1">Please select a league first.</p>
          )}
           {selectedLeague && teamsInSelectedLeague.length === 0 && (
            <p className="text-xs text-red-500 mt-1">No teams found for this league in the current filter.</p>
          )}
        </div>

        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-hidden focus:ring-2 focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            onClick={handleSelectTeam}
            className="px-4 py-2 bg-brand-dark text-white rounded-md hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-brand-medium disabled:opacity-50"
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
