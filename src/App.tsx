import React, { useState, useEffect } from 'react';
import TeamCard from './components/TeamCard';
import { Team } from './types';
// import { mockTeams } from './data/teams'; // No longer using mock data
import { supabase } from './lib/supabaseClient'; // Import Supabase client
import { Dices } from 'lucide-react';

// Fetch teams from Supabase
const fetchTeams = async (): Promise<Team[]> => {
  console.log("Fetching teams from Supabase...");
  const { data, error } = await supabase
    .from('teams') // Ensure this matches your table name
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
    `); // Select all required columns

  if (error) {
    console.error("Error fetching teams:", error);
    throw new Error(`Failed to fetch teams: ${error.message}`);
  }

  console.log("Teams fetched successfully:", data);

  // Assuming column names match the Team type camelCase directly (as defined in migration)
  // If Supabase columns were snake_case (e.g., logo_url), you'd map here:
  // return data.map(team => ({ ...team, logoUrl: team.logo_url }));
  return data || []; // Return empty array if data is null
};

// Function to get two different random teams
const getRandomMatch = (teams: Team[]): [Team, Team] | null => {
  if (teams.length < 2) {
    return null; // Not enough teams
  }
  let index1 = Math.floor(Math.random() * teams.length);
  let index2 = Math.floor(Math.random() * teams.length);
  // Ensure the teams are different
  while (index1 === index2) {
    index2 = Math.floor(Math.random() * teams.length);
  }
  return [teams[index1], teams[index2]];
};

function App() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [match, setMatch] = useState<[Team, Team] | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null); // Reset error on new fetch attempt
    fetchTeams()
      .then(data => {
        if (data.length === 0) {
          console.warn("No teams found in the database.");
          // Suggest seeding if the table is empty
          setError("No teams found. Please ensure the database table 'teams' exists and contains data. You might need to run the seed script.");
        } else {
          setTeams(data);
          setMatch(getRandomMatch(data)); // Set initial match
        }
      })
      .catch(err => {
        console.error("Failed to fetch teams in useEffect:", err);
        // Use the error message thrown from fetchTeams
        setError(err.message || "Failed to load teams. Please check the console and ensure the database is reachable and populated.");
        setTeams([]);
        setMatch(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []); // Empty dependency array means this runs once on mount

  const handleGenerateMatch = () => {
    if (teams.length > 0) {
      setMatch(getRandomMatch(teams));
    }
  };

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
        <div className="w-full max-w-4xl mb-8"> {/* Increased max-width slightly */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8"> {/* Adjusted gap */}
            {/* Team 1 Card */}
            <div className="w-full md:w-auto">
              <TeamCard team={match[0]} differences={team1Differences} />
            </div>

            {/* VS Separator */}
            <div className="flex flex-col items-center my-4 md:my-0">
              <div className="text-2xl font-bold text-gray-700">VS</div>
            </div>

            {/* Team 2 Card */}
            <div className="w-full md:w-auto">
              <TeamCard team={match[1]} differences={team2Differences} />
            </div>
          </div>
        </div>
      )}

      {/* Show button only if not loading, no error, and teams are loaded */}
      {!loading && !error && teams.length > 0 && (
         <button
          onClick={handleGenerateMatch}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-50"
          disabled={teams.length < 2} // Disable if less than 2 teams loaded
        >
          <Dices className="w-5 h-5 mr-2" />
          Generate New Match
        </button>
      )}

      {/* Informative message if loading finished but not enough teams */}
       {!loading && !error && teams.length < 2 && teams.length > 0 && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded mt-4 text-center">Only {teams.length} team loaded. Need at least 2 to generate a match.</p>
       )}
       {/* Message if loading finished and NO teams were loaded (different from error state) */}
       {!loading && !error && teams.length === 0 && !loading && ( // Added !loading check here
         <p className="text-gray-600 mt-4 text-center">No teams available to display.</p>
       )}
    </div>
  );
}

export default App;
