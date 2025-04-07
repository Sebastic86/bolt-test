import React, { useState, useEffect } from 'react';
import TeamCard from './components/TeamCard';
import { Team } from './types';
import { mockTeams } from './data/teams'; // Using mock data for now
import { Dices } from 'lucide-react';

// Simulate API fetch
const fetchTeams = async (): Promise<Team[]> => {
  // Replace with actual API call in the future
  await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network delay
  return mockTeams;
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
    fetchTeams()
      .then(data => {
        setTeams(data);
        setMatch(getRandomMatch(data)); // Set initial match
        setError(null);
      })
      .catch(err => {
        console.error("Failed to fetch teams:", err);
        setError("Failed to load teams. Please try again later.");
        setTeams([]);
        setMatch(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleGenerateMatch = () => {
    if (teams.length > 0) {
      setMatch(getRandomMatch(teams));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-100 via-purple-100 to-pink-100 p-4 flex flex-col items-center justify-center">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-8 text-center">
        EA FC Random Match Generator
      </h1>

      {loading && <p className="text-gray-600">Loading teams...</p>}
      {error && <p className="text-red-600 bg-red-100 p-3 rounded">{error}</p>}

      {!loading && !error && match && (
        <div className="w-full max-w-3xl mb-8">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
            {/* Team 1 Card */}
            <div className="w-full md:w-1/2">
              <TeamCard team={match[0]} />
            </div>

            {/* VS Separator */}
            <div className="text-2xl font-bold text-gray-700 my-4 md:my-0">VS</div>

            {/* Team 2 Card */}
            <div className="w-full md:w-1/2">
              <TeamCard team={match[1]} />
            </div>
          </div>
        </div>
      )}

      {!loading && !error && teams.length > 0 && (
         <button
          onClick={handleGenerateMatch}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition duration-150 ease-in-out disabled:opacity-50"
          disabled={teams.length < 2}
        >
          <Dices className="w-5 h-5 mr-2" />
          Generate New Match
        </button>
      )}
       {!loading && !error && teams.length < 2 && (
         <p className="text-yellow-700 bg-yellow-100 p-3 rounded mt-4">Not enough teams loaded to generate a match.</p>
       )}
    </div>
  );
}

export default App;
