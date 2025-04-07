import React, { useState, useEffect, useCallback, useMemo } from 'react';
import TeamCard from './components/TeamCard';
import EditTeamModal from './components/EditTeamModal';
import SettingsModal from './components/SettingsModal'; // Import SettingsModal
import { Team } from './types';
import { supabase } from './lib/supabaseClient';
import { Dices, Settings } from 'lucide-react'; // Import Settings icon

// --- Constants for Session Storage ---
const MIN_RATING_STORAGE_KEY = 'fcGeneratorMinRating';
const MAX_RATING_STORAGE_KEY = 'fcGeneratorMaxRating';

// --- Helper Functions for Session Storage ---
const getInitialRating = (key: string, defaultValue: number): number => {
  try {
    const storedValue = sessionStorage.getItem(key);
    if (storedValue !== null) {
      const parsedValue = parseFloat(storedValue);
      // Basic validation
      if (!isNaN(parsedValue) && parsedValue >= 0 && parsedValue <= 5) {
        return parsedValue;
      }
    }
  } catch (error) {
    console.error(`Error reading ${key} from sessionStorage:`, error);
  }
  return defaultValue;
};

// Fetch all teams from Supabase (filtering happens client-side now)
const fetchAllTeams = async (): Promise<Team[]> => {
  console.log("Fetching all teams from Supabase...");
  const { data, error } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      league,
      rating,
      logoUrl,
      overallRating,
      attackRating,
      midfieldRating,
      defendRating
    `);

  if (error) {
    console.error("Error fetching teams:", error);
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }
  console.log("All teams fetched successfully:", data);
  return data || [];
};

// Function to get a random team from a filtered list
const getRandomTeam = (teams: Team[], excludeId?: string): Team | null => {
  if (teams.length === 0) return null;
  if (teams.length === 1 && teams[0].id === excludeId) return null;

  let availableTeams = teams;
  if (excludeId) {
    availableTeams = teams.filter(team => team.id !== excludeId);
    if (availableTeams.length === 0) return null;
  }

  const randomIndex = Math.floor(Math.random() * availableTeams.length);
  return availableTeams[randomIndex];
};

// Function to get an initial match from a filtered list
const getInitialMatch = (teams: Team[]): [Team, Team] | null => {
  if (teams.length < 2) return null;
  const team1 = getRandomTeam(teams);
  if (!team1) return null;
  const team2 = getRandomTeam(teams, team1.id);
  if (!team2) return null;
  return [team1, team2];
};


function App() {
  const [allTeams, setAllTeams] = useState<Team[]>([]); // Store all fetched teams
  const [match, setMatch] = useState<[Team, Team] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Settings State - Initialize from sessionStorage
  const [minRating, setMinRating] = useState<number>(() =>
    getInitialRating(MIN_RATING_STORAGE_KEY, 0)
  );
  const [maxRating, setMaxRating] = useState<number>(() =>
    getInitialRating(MAX_RATING_STORAGE_KEY, 5)
  );
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<0 | 1 | null>(null);

  // Filtered teams based on rating settings
  const filteredTeams = useMemo(() => {
    return allTeams.filter(team => team.rating >= minRating && team.rating <= maxRating);
  }, [allTeams, minRating, maxRating]);

  // Fetch all teams once on mount
  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchAllTeams()
      .then(data => {
        if (data.length === 0) {
          console.warn("No teams found in the database.");
          setError("No teams found. Please ensure the database table 'teams' exists and contains data.");
          setAllTeams([]);
        } else {
          setAllTeams(data);
          // Initial match generation uses the potentially session-loaded filters via filteredTeams
        }
      })
      .catch(err => {
        console.error("Failed to fetch teams in useEffect:", err);
        setError(err.message || "Failed to load teams.");
        setAllTeams([]);
        setMatch(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // Empty dependency array: Fetch teams only once

  // Effect to set initial match or update when filters change
  useEffect(() => {
    if (!loading && filteredTeams.length > 0) {
        const currentMatchIsValid = match &&
                                    filteredTeams.some(t => t.id === match[0].id) &&
                                    filteredTeams.some(t => t.id === match[1].id);

        if (!currentMatchIsValid) {
             setMatch(getInitialMatch(filteredTeams));
        }
    } else if (!loading && filteredTeams.length < 2) {
        setMatch(null); // Clear match if not enough teams meet criteria
    }
    // Intentionally not depending on `match` here to avoid re-running when match changes internally
  }, [filteredTeams, loading]); // Depend on filteredTeams and loading state


  const handleGenerateNewMatch = () => {
    if (filteredTeams.length >= 2) {
      setMatch(getInitialMatch(filteredTeams));
    }
  };

  // --- Edit Modal Handlers ---
  const handleOpenEditModal = (index: 0 | 1) => {
    setEditingTeamIndex(index);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingTeamIndex(null);
  };

  const handleUpdateTeam = useCallback((newTeam: Team) => {
    if (editingTeamIndex === null || !match) return;

    const otherTeamIndex = editingTeamIndex === 0 ? 1 : 0;
    let newOpponent = match[otherTeamIndex];

    if (newOpponent.id === newTeam.id) {
      const potentialOpponent = getRandomTeam(filteredTeams, newTeam.id);
      if (potentialOpponent) {
        newOpponent = potentialOpponent;
      } else {
         console.warn("Could not find a different opponent within the current filter.");
      }
    }

    const updatedMatch: [Team, Team] = [...match];
    updatedMatch[editingTeamIndex] = newTeam;
    updatedMatch[otherTeamIndex] = newOpponent;
    setMatch(updatedMatch);

    handleCloseEditModal();
  }, [match, editingTeamIndex, filteredTeams]);

  // --- Settings Modal Handlers ---
  const handleOpenSettingsModal = () => {
    setIsSettingsModalOpen(true);
  };

  const handleCloseSettingsModal = () => {
    setIsSettingsModalOpen(false);
  };

  const handleSaveSettings = (newMinRating: number, newMaxRating: number) => {
    // Update state
    setMinRating(newMinRating);
    setMaxRating(newMaxRating);

    // Save to sessionStorage
    try {
      sessionStorage.setItem(MIN_RATING_STORAGE_KEY, newMinRating.toString());
      sessionStorage.setItem(MAX_RATING_STORAGE_KEY, newMaxRating.toString());
    } catch (error) {
      console.error("Error saving settings to sessionStorage:", error);
      // Optionally notify the user that settings couldn't be saved
    }

    // The useEffect depending on filteredTeams will handle updating the match if needed
  };


  // Calculate differences if match exists
  const differences = match ? {
    overall: match[0].overallRating - match[1].overallRating,
    attack: match[0].attackRating - match[1].attackRating,
    midfield: match[0].midfieldRating - match[1].midfieldRating,
    defend: match[0].defendRating - match[1].defendRating,
  } : null;

  const team1Differences = differences ? { overall: differences.overall, attack: differences.attack, midfield: differences.midfield, defend: differences.defend } : undefined;
  const team2Differences = differences ? { overall: -differences.overall, attack: -differences.attack, midfield: -differences.midfield, defend: -differences.defend } : undefined;


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4 flex flex-col items-center justify-center">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8 text-center">
        EA FC Random Match Generator
      </h1>

      {loading && <p className="text-gray-600">Loading teams...</p>}
      {error && <p className="text-red-600 bg-red-100 p-3 rounded text-center">{error}</p>}

      {!loading && !error && match && (
        <div className="w-full max-w-4xl mb-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
            <TeamCard
              team={match[0]}
              differences={team1Differences}
              onEdit={() => handleOpenEditModal(0)}
            />
            <div className="flex flex-col items-center my-4 md:my-0">
              <div className="text-2xl font-bold text-gray-700">VS</div>
            </div>
            <TeamCard
              team={match[1]}
              differences={team2Differences}
              onEdit={() => handleOpenEditModal(1)}
            />
          </div>
        </div>
      )}

       {/* Buttons Container */}
       {!loading && !error && allTeams.length > 0 && (
         <div className="flex items-center space-x-4 mt-4"> {/* Added margin-top */}
           {/* Generate New Match Button */}
           <button
             onClick={handleGenerateNewMatch}
             className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-50"
             disabled={filteredTeams.length < 2} // Disable based on filtered teams
           >
             <Dices className="w-5 h-5 mr-2" />
             Generate New Match
           </button>

           {/* Settings Button */}
           <button
             onClick={handleOpenSettingsModal}
             className="p-3 bg-gray-600 text-white rounded-lg shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition duration-150 ease-in-out"
             aria-label="Open settings"
           >
             <Settings className="w-5 h-5" />
           </button>
         </div>
       )}


      {/* Informative messages */}
       {!loading && !error && allTeams.length > 0 && filteredTeams.length < 2 && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded mt-4 text-center">
           Only {filteredTeams.length} team(s) match the current rating filter ({minRating.toFixed(1)} - {maxRating.toFixed(1)} stars). Need at least 2 to generate a match. Adjust settings or wait for more teams.
         </p>
       )}
       {!loading && !error && allTeams.length === 0 && (
         <p className="text-gray-600 mt-4 text-center">No teams available to display.</p>
       )}

      {/* Edit Team Modal */}
      <EditTeamModal
        isOpen={isEditModalOpen}
        onClose={handleCloseEditModal}
        allTeams={filteredTeams} // Pass filtered teams to the edit modal
        onTeamSelected={handleUpdateTeam}
        currentTeam={editingTeamIndex !== null && match ? match[editingTeamIndex] : undefined}
      />

      {/* Settings Modal */}
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
        onSave={handleSaveSettings}
        initialMinRating={minRating}
        initialMaxRating={maxRating}
      />
    </div>
  );
}

export default App;
