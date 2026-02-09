import React, { useState } from 'react';
import { Users, List, Wrench } from 'lucide-react';
import { Team, Player, MatchHistoryItem } from '../types';
import TeamManagement from './TeamManagement';
import AllMatches from './AllMatches';
import DevToolsPanel from './DevToolsPanel';

interface AdminPageProps {
  allTeams: Team[];
  allMatches: MatchHistoryItem[];
  allPlayers: Player[];
  loadingTeams: boolean;
  loadingMatches: boolean;
  matchesError: string | null;
  onRefreshTeams: () => void;
  onRefreshMatches: () => void;
}

type AdminTab = 'teams' | 'matches' | 'devtools';

const AdminPage: React.FC<AdminPageProps> = ({
  allTeams,
  allMatches,
  allPlayers,
  loadingTeams,
  loadingMatches,
  matchesError,
  onRefreshTeams,
  onRefreshMatches,
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('teams');

  return (
    <div className="w-full max-w-7xl mx-auto px-4 mt-8 mb-20 md:mb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Admin Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage teams, matches, and system tools</p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-lg shadow-sm border border-brand-light mb-6 overflow-x-auto">
        <div className="flex">
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex-1 min-w-[120px] flex items-center justify-center px-6 py-4 font-medium transition-all ${
              activeTab === 'teams'
                ? 'bg-brand-dark text-white border-b-4 border-brand-medium'
                : 'bg-white text-gray-600 hover:bg-brand-lighter'
            }`}
          >
            <Users className="w-5 h-5 mr-2" />
            <span className="hidden sm:inline">Teams</span>
            <span className="sm:hidden">Teams</span>
          </button>

          <button
            onClick={() => setActiveTab('matches')}
            className={`flex-1 min-w-[120px] flex items-center justify-center px-6 py-4 font-medium transition-all ${
              activeTab === 'matches'
                ? 'bg-brand-dark text-white border-b-4 border-brand-medium'
                : 'bg-white text-gray-600 hover:bg-brand-lighter'
            }`}
          >
            <List className="w-5 h-5 mr-2" />
            <span className="hidden sm:inline">Matches</span>
            <span className="sm:hidden">Matches</span>
          </button>

          <button
            onClick={() => setActiveTab('devtools')}
            className={`flex-1 min-w-[120px] flex items-center justify-center px-6 py-4 font-medium transition-all ${
              activeTab === 'devtools'
                ? 'bg-brand-dark text-white border-b-4 border-brand-medium'
                : 'bg-white text-gray-600 hover:bg-brand-lighter'
            }`}
          >
            <Wrench className="w-5 h-5 mr-2" />
            <span className="hidden sm:inline">Dev Tools</span>
            <span className="sm:hidden">Tools</span>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex justify-center">
        {activeTab === 'teams' && (
          <TeamManagement allTeams={allTeams} onRefresh={onRefreshTeams} />
        )}

        {activeTab === 'matches' && (
          <AllMatches
            allMatches={allMatches}
            loading={loadingMatches}
            error={matchesError}
            onRefresh={onRefreshMatches}
            allPlayers={allPlayers}
          />
        )}

        {activeTab === 'devtools' && <DevToolsPanel />}
      </div>
    </div>
  );
};

export default AdminPage;
