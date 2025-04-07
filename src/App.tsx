import React, { useState, useEffect, useCallback } from 'react';
import TeamCard from './components/TeamCard';
import EditTeamModal from './components/EditTeamModal'; // Import the modal
import { Team } from './types';
import { supabase } from './lib/supabaseClient';
import { Dices } from 'lucide-react';

// Fetch teams from Supabase
const fetchTeams = async (): Promise<Team[]> => {
  console.log("Fetching teams from Supabase...");
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
  console.log("Teams fetched successfully:", data);
  return data || [];
};

// Function to get two different random teams
const getRandomTeam = (teams: Team[], excludeId?: string): Team | null => {
  if (teams.length === 0) return null;
  if (teams.length === 1 && teams[0].id === excludeId) return null; // Cannot pick if only one team exists and it's excluded

  let availableTeams = teams;
  if (excludeId) {
    availableTeams = teams.filter(team => team.id !== excludeId);
    if (availableTeams.length === 0) return null; // No other team to pick
  }

  const randomIndex = Math.floor(Math.random() * availableTeams.length);
  return availableTeams[randomIndex];
};

const getInitialMatch = (teams: Team[]): [Team, Team] | null => {
  if (teams.length < 2) return null;
  const team1 = getRandomTeam(teams);
  if (!team1) return null;
  const team2 = getRandomTeam(teams, team1.id);
  if (!team2) return null; // Should theoretically not happen if length >= 2
  return [team1, team2];
};


function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [match, setMatch] = useState<[Team, Team] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<0 | 1 | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchTeams()
      .then(data => {
        if (data.length === 0) {
          console.warn("No teams found in the database.");
          setError("No teams found. Please ensure the database table 'teams' exists and contains data.");
        } else {
          setTeams(data);
          setMatch(getInitialMatch(data)); // Set initial match
        }
      })
      .catch(err => {
        console.error("Failed to fetch teams in useEffect:", err);
        setError(err.message || "Failed to load teams.");
        setTeams([]);
        setMatch(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleGenerateNewMatch = () => {
    if (teams.length >= 2) {
      setMatch(getInitialMatch(teams));
    }
  };

  // --- Modal Handlers ---
  const handleOpenEditModal = (index: 0 | 1) => {
    setEditingTeamIndex(index);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTeamIndex(null);
  };

  const handleUpdateTeam = useCallback((newTeam: Team) => {
    if (editingTeamIndex === null || !match) return;

    // Ensure the new team is not the same as the *other* team in the match
    const otherTeamIndex = editingTeamIndex === 0 ? 1 : 0;
    if (match[otherTeamIndex].id === newTeam.id) {
      // If the selected team is the same as the opponent, pick a new random opponent
      const newOpponent = getRandomTeam(teams, newTeam.id);
      if (newOpponent) {
        const updatedMatch: [Team, Team] = [...match];
        updatedMatch[editingTeamIndex] = newTeam;
        updatedMatch[otherTeamIndex] = newOpponent;
        setMatch(updatedMatch);
      } else {
        // Fallback: just update the edited team (should be rare)
         const updatedMatch: [Team, Team] = [...match];
         updatedMatch[editingTeamIndex] = newTeam;
         setMatch(updatedMatch);
      }
    } else {
      // Update the team at the specific index
      const updatedMatch: [Team, Team] = [...match];
      updatedMatch[editingTeamIndex] = newTeam;
      setMatch(updatedMatch);
    }

    handleCloseModal(); // Close modal after selection
  }, [match, editingTeamIndex, teams]); // Include dependencies


  // Calculate differences if match exists
  const differences = match ? {
    overall: match[0].overallRating - match[1].overallRating,
    attack: match[0].attackRating - match[1].attackRating,
    midfield: match[0].midfieldRating - match[1].midfieldRating,
    defend: match[0].defendRating - match[1].defendRating,
  } : null;

  // Prepare differences for each team card
  const team1Differences = differences ? {
    overall: differences.overall,
    attack: differences.attack,
    midfield: differences.midfield,
    defend: differences.defend,
  } : undefined;

  const team2Differences = differences ? {
    overall: -differences.overall,
    attack: -differences.attack,
    midfield: -differences.midfield,
    defend: -differences.defend,
  } : undefined;


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
            {/* Team 1 Card */}
            <div className="w-full md:w-auto">
              <TeamCard
                team={match[0]}
                differences={team1Differences}
                onEdit={() => handleOpenEditModal(0)} // Pass edit handler
              />
            </div>

            {/* VS Separator */}
            <div className="flex flex-col items-center my-4 md:my-0">
              <div className="text-2xl font-bold text-gray-700">VS</div>
            </div>

            {/* Team 2 Card */}
            <div className="w-full md:w-auto">
              <TeamCard
                team={match[1]}
                differences={team2Differences}
                onEdit={() => handleOpenEditModal(1)} // Pass edit handler
              />
            </div>
          </div>
        </div>
      )}

      {/* Generate New Match Button */}
      {!loading && !error && teams.length > 0 && (
         <button
          onClick={handleGenerateNewMatch}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-50"
          disabled={teams.length < 2}
        >
          <Dices className="w-5 h-5 mr-2" />
          Generate New Match
        </button>
      )}

      {/* Informative messages */}
       {!loading && !error && teams.length < 2 && teams.length > 0 && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded mt-4 text-center">Only {teams.length} team loaded. Need at least 2 to generate a match.</p>
       )}
       {!loading && !error && teams.length === 0 && (
         <p className="text-gray-600 mt-4 text-center">No teams available to display.</p>
       )}

      {/* Edit Team Modal */}
      <EditTeamModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        allTeams={teams}
        onTeamSelected={handleUpdateTeam}
        currentTeam={editingTeamIndex !== null && match ? match[editingTeamIndex] : undefined}
      />
    </div>
  );
}

export default App;
