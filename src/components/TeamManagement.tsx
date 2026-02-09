import React, { useState, useEffect, useMemo } from 'react';
import { Search, RefreshCw, Edit, Plus } from 'lucide-react';
import { Team } from '../types';
import { searchTeams } from '../services/teamService';
import { TeamLogo } from './TeamLogo';
import EditTeamFullModal from './EditTeamFullModal';

interface TeamManagementProps {
  allTeams: Team[];
  onRefresh: () => void;
}

const TeamManagement: React.FC<TeamManagementProps> = ({ allTeams, onRefresh }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState<'all' | 'name' | 'league'>('all');
  const [loading, setLoading] = useState(false);
  const [filteredTeams, setFilteredTeams] = useState<Team[]>(allTeams);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filter teams locally
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTeams(allTeams);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = allTeams.filter(team => {
      if (filterBy === 'name') {
        return team.name.toLowerCase().includes(query);
      } else if (filterBy === 'league') {
        return team.league.toLowerCase().includes(query);
      } else {
        return (
          team.name.toLowerCase().includes(query) ||
          team.league.toLowerCase().includes(query)
        );
      }
    });

    setFilteredTeams(filtered);
  }, [searchQuery, filterBy, allTeams]);

  const handleEditTeam = (team: Team) => {
    setSelectedTeam(team);
    setIsEditModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedTeam(null);
  };

  const handleTeamUpdated = () => {
    onRefresh();
  };

  const handleTeamDeleted = () => {
    onRefresh();
  };

  // Group teams by league
  const teamsByLeague = useMemo(() => {
    const grouped: { [league: string]: Team[] } = {};
    filteredTeams.forEach(team => {
      if (!grouped[team.league]) {
        grouped[team.league] = [];
      }
      grouped[team.league].push(team);
    });
    return grouped;
  }, [filteredTeams]);

  const leagues = Object.keys(teamsByLeague).sort();

  return (
    <div className="w-full max-w-6xl mt-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-gray-700">Team Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            {filteredTeams.length} of {allTeams.length} teams
          </p>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center px-4 py-2 bg-brand-dark text-white rounded-md hover:bg-brand-medium disabled:opacity-50 transition"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-brand-lighter border border-brand-light rounded-lg p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search teams..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-brand-medium"
            />
          </div>
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e.target.value as 'all' | 'name' | 'league')}
            className="px-4 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-brand-medium"
          >
            <option value="all">All Fields</option>
            <option value="name">Team Name</option>
            <option value="league">League</option>
          </select>
        </div>
      </div>

      {/* Teams Grid */}
      {filteredTeams.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          <p className="text-lg">No teams found</p>
          <p className="text-sm mt-2">Try adjusting your search criteria</p>
        </div>
      ) : (
        <div className="space-y-8">
          {leagues.map(league => (
            <div key={league}>
              <h3 className="text-xl font-semibold text-gray-800 mb-4 flex items-center">
                <span className="bg-brand-dark text-white px-3 py-1 rounded-md">
                  {league}
                </span>
                <span className="ml-3 text-sm text-gray-600">
                  ({teamsByLeague[league].length} teams)
                </span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {teamsByLeague[league].map(team => (
                  <div
                    key={team.id}
                    className="bg-white border border-brand-light rounded-lg p-4 hover:shadow-lg transition cursor-pointer"
                    onClick={() => handleEditTeam(team)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <TeamLogo
                          team={{
                            name: team.name,
                            logoUrl: team.logoUrl,
                            apiTeamId: team.apiTeamId,
                            apiTeamName: team.apiTeamName,
                            resolvedLogoUrl: team.resolvedLogoUrl,
                          }}
                          size="md"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-gray-800 truncate">
                          {team.name}
                        </h4>
                        <p className="text-sm text-gray-600">{team.version}</p>
                        <div className="flex items-center mt-2">
                          <span className="text-yellow-500 text-sm font-medium">
                            ★ {team.rating.toFixed(1)}
                          </span>
                          <span className="mx-2 text-gray-400">|</span>
                          <span className="text-xs text-gray-500">
                            OVR {team.overallRating}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEditTeam(team);
                        }}
                        className="p-2 text-brand-dark hover:bg-brand-lighter rounded-md transition"
                        title="Edit Team"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit Team Modal */}
      {selectedTeam && (
        <EditTeamFullModal
          isOpen={isEditModalOpen}
          onClose={handleCloseModal}
          team={selectedTeam}
          onTeamUpdated={handleTeamUpdated}
          onTeamDeleted={handleTeamDeleted}
        />
      )}
    </div>
  );
};

export default TeamManagement;
