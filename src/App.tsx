import { useState, useEffect, useMemo, useCallback } from 'react';
import Header from './components/Header';
import AuthWrapper from './components/AuthWrapper';
import { AdminOnly } from './components/RoleBasedComponents';
import UserManagement from './components/UserManagement';
import TeamCard from './components/TeamCard';
import EditTeamModal from './components/EditTeamModal';
import SettingsModal from './components/SettingsModal';
import AddMatchModal from './components/AddMatchModal';
import MatchHistory from './components/MatchHistory';
import AllMatches from './components/AllMatches';
import PlayerStandings from './components/PlayerStandings';
import TopWinPercentageTeams from './components/TopWinPercentageTeams';
import TopLossPercentageTeams from './components/TopLossPercentageTeams';
import PlayerWinMatrix from './components/PlayerWinMatrix';
import PlayerTopTeams from './components/PlayerTopTeams';
import CollapsibleSection from './components/CollapsibleSection';
import BottomNav from './components/BottomNav';
import MatchComparison from './components/MatchComparison';
import PlayerAchievements from './components/PlayerAchievements';
import MatchRevealAnimation from './components/MatchRevealAnimation';
import ErrorBoundary from './components/ErrorBoundary';
import GameSessions from './components/GameSessions';
import { Team, Player } from './types';
import { supabase } from './lib/supabaseClient';
import { useAuth } from './contexts/AuthContext';
import { useSettings } from './hooks/useSettings';
import { useMatchData, fetchAllTeams, fetchAllPlayers } from './hooks/useMatchData';
import { useMatchGenerator } from './hooks/useMatchGenerator';
import { usePlayerStandings } from './hooks/usePlayerStandings';
import { useTeamStatistics } from './hooks/useTeamStatistics';
import { Dices, Settings, PlusSquare, List, ArrowLeft } from 'lucide-react';


function App() {
  const { isAdmin } = useAuth();
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [initError, setInitError] = useState<string | null>(null);

  // Settings (persisted to localStorage)
  const settings = useSettings();
  const {
    minRating, maxRating, excludeNations, selectedVersion, maxOvrDiff,
    isSettingsModalOpen, handleOpenSettingsModal, handleCloseSettingsModal, handleSaveSettings,
  } = settings;

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [editingTeamIndex, setEditingTeamIndex] = useState<0 | 1 | null>(null);

  // Add Match Modal State
  const [isAddMatchModalOpen, setIsAddMatchModalOpen] = useState<boolean>(false);

  // Page Navigation State
  const [currentPage, setCurrentPage] = useState<'main' | 'allMatches'>('main');

  // Filtered teams based on rating, nation, and version settings
  const filteredTeams = useMemo(() => {
    return allTeams.filter(team => {
      const ratingMatch = team.rating >= minRating && team.rating <= maxRating;
      const nationMatch = !excludeNations || team.league !== 'Nation';
      const versionMatch = team.version === selectedVersion;
      return ratingMatch && nationMatch && versionMatch;
    });
  }, [allTeams, minRating, maxRating, excludeNations, selectedVersion]);

  // Match data (with real-time subscriptions)
  const matchData = useMatchData(allTeams, allPlayers);
  const {
    matchesToday, allMatches, loadingHistory, loadingAllMatches,
    historyError, allMatchesError, triggerRefresh, fetchAllMatchesData,
  } = matchData;

  // Match generator
  const generator = useMatchGenerator({
    allTeams, filteredTeams, matchesToday, allMatches,
    maxOvrDiff, excludeNations, minRating, maxRating, loading,
  });
  const {
    match, isAnimating, pendingMatch, error: matchError,
    canGenerateNewMatch, playedTeamIdsToday, initialMatchPlayers,
    handleGenerateNewMatch, handleAnimationComplete, handleUpdateTeam,
    setLastMatchPlayers, setMatchError,
  } = generator;

  // Player standings (today + overall)
  const { playerStandings, overallPlayerStandings } = usePlayerStandings(
    matchesToday, allMatches, allPlayers, allTeams
  );

  // Team statistics
  const { teamStatistics } = useTeamStatistics(allMatches, allTeams);

  // Fetch initial data (teams, players)
  useEffect(() => {
    setLoading(true);
    setInitError(null);
    Promise.all([fetchAllTeams(), fetchAllPlayers()])
      .then(([teamsData, playersData]) => {
        if (teamsData.length === 0) {
          console.warn("No teams found in the database.");
          setInitError("No teams found. Please ensure the 'teams' table exists and contains data.");
          setAllTeams([]);
        } else {
          setAllTeams(teamsData);
        }
        setAllPlayers(playersData);
      })
      .catch(err => {
        console.error("Failed to fetch initial data:", err);
        setInitError(err.message || "Failed to load initial data.");
        setAllTeams([]);
        setAllPlayers([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  // --- Edit Modal Handlers ---
  const handleOpenEditModal = (index: 0 | 1) => {
    setEditingTeamIndex(index);
    setIsEditModalOpen(true);
  };
  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setEditingTeamIndex(null);
  };
  const handleTeamSelected = useCallback((newTeam: Team) => {
    if (editingTeamIndex === null) return;
    handleUpdateTeam(newTeam, editingTeamIndex);
    handleCloseEditModal();
  }, [editingTeamIndex, handleUpdateTeam]);

  // --- Player Name Update Handler ---
  const handleUpdatePlayerName = async (playerId: string, newName: string): Promise<boolean> => {
    if (!isAdmin) {
      console.warn('[App] Non-admin attempted to update a player name.');
      return false;
    }
    console.log(`[App] Attempting to update player ${playerId} to name: ${newName}`);
    try {
      const { error } = await supabase
        .from('players')
        .update({ name: newName })
        .eq('id', playerId)
        .select()
        .single();

      if (error) {
        console.error(`[App] Error updating player ${playerId} in DB:`, error);
        throw error;
      }

      console.log(`[App] Player ${playerId} updated successfully in DB.`);
      setAllPlayers(prevPlayers =>
        prevPlayers.map(p => (p.id === playerId ? { ...p, name: newName } : p))
      );
      return true;
    } catch (err) {
      console.error(`[App] Error updating player ${playerId} in DB:`, err);
      return false;
    }
  };

  // --- Add Match Modal Handlers ---
  const handleOpenAddMatchModal = () => setIsAddMatchModalOpen(true);
  const handleCloseAddMatchModal = () => setIsAddMatchModalOpen(false);
  const handleMatchSaved = (payload: {
    team1Id: string;
    team2Id: string;
    team1Players: Player[];
    team2Players: Player[];
    action: 'next' | 'rematch';
  }) => {
    triggerRefresh();
    setLastMatchPlayers({
      team1Id: payload.team1Id,
      team2Id: payload.team2Id,
      team1Players: payload.team1Players,
      team2Players: payload.team2Players,
    });

    if (payload.action === 'next') {
      handleGenerateNewMatch(new Set([payload.team1Id, payload.team2Id]));
    }
  };

  // --- Manual Refresh Handler ---
  const handleManualRefreshHistory = () => {
    triggerRefresh();
  };

  // Page Navigation Handlers
  const handleNavigateToAllMatches = () => setCurrentPage('allMatches');
  const handleNavigateToMain = () => setCurrentPage('main');
  const handleRefreshAllMatches = () => fetchAllMatchesData();

  // Calculate differences
  const differences = match ? {
    overall: match[0].overallRating - match[1].overallRating,
    attack: match[0].attackRating - match[1].attackRating,
    midfield: match[0].midfieldRating - match[1].midfieldRating,
    defend: match[0].defendRating - match[1].defendRating,
  } : null;
  const team1Differences = differences ? { overall: differences.overall, attack: differences.attack, midfield: differences.midfield, defend: differences.defend } : undefined;
  const team2Differences = differences ? { overall: -differences.overall, attack: -differences.attack, midfield: -differences.midfield, defend: -differences.defend } : undefined;

  // Combined error display
  const displayError = initError || matchError;

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <AuthWrapper>
        <main className="grow bg-linear-to-br from-brand-lighter via-brand-light to-brand-medium p-4 pb-20 md:pb-4 flex flex-col items-center">

        {loading && <p className="text-gray-600 mt-8">Loading initial data...</p>}
        {displayError && <p className="text-red-600 bg-red-100 p-3 rounded-sm text-center mb-4 max-w-xl mx-auto mt-8">{displayError}</p>}

        {/* Match Reveal Animation */}
        {!loading && !initError && isAnimating && pendingMatch && (
          <MatchRevealAnimation
            teams={pendingMatch}
            allTeams={filteredTeams}
            onAnimationComplete={handleAnimationComplete}
          />
        )}

        {/* Match Display */}
        {!loading && !initError && match && !isAnimating && (
          <ErrorBoundary fallbackTitle="Error displaying match">
            <div className="w-full max-w-4xl mb-6 mt-8">
              <div className="flex flex-col md:flex-row items-center justify-center gap-4 md:gap-8">
                <TeamCard team={match[0]} differences={team1Differences} onEdit={() => handleOpenEditModal(0)} />
                <div className="text-2xl font-bold text-gray-700 my-2 md:my-0">VS</div>
                <TeamCard team={match[1]} differences={team2Differences} onEdit={() => handleOpenEditModal(1)} />
              </div>
              <MatchComparison team1={match[0]} team2={match[1]} />
            </div>
          </ErrorBoundary>
        )}
         {!loading && !initError && !match && filteredTeams.length >= 2 && !canGenerateNewMatch && (
           <p className="text-yellow-700 bg-yellow-100 p-3 rounded-sm mb-6 text-center max-w-md mt-8">
              No valid matchup displayed. All teams within the current filter have played today.
           </p>
         )}

         {/* Buttons Container */}
         {!loading && !initError && allTeams.length > 0 && currentPage === 'main' && (
           <div className="flex items-center justify-center mb-6">
             <div className="hidden md:inline-flex rounded-lg shadow-md overflow-hidden">
               <button
                 onClick={() => handleGenerateNewMatch()}
                 className="flex items-center justify-center px-5 py-2.5 bg-brand-dark text-white font-semibold hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed border-r border-white/20"
                 disabled={!canGenerateNewMatch}
                 title={canGenerateNewMatch ? "Generate New Random Matchup (excluding teams played today)" : "Not enough unplayed teams available in filter"}
               >
                 <Dices className="w-5 h-5 mr-2" /> New Matchup
               </button>
               <AdminOnly>
                 <button
                   onClick={handleOpenAddMatchModal}
                   className="flex items-center justify-center px-5 py-2.5 bg-brand-dark text-white font-semibold hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out disabled:opacity-60 disabled:cursor-not-allowed border-r border-white/20"
                   disabled={!match}
                   title="Add Current Matchup to History"
                 >
                   <PlusSquare className="w-5 h-5 mr-2" /> Add Match
                 </button>
               </AdminOnly>
               <button
                 onClick={handleNavigateToAllMatches}
                 className="flex items-center justify-center px-5 py-2.5 bg-brand-dark text-white font-semibold hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out border-r border-white/20"
                 title="View and Edit All Matches"
               >
                 <List className="w-5 h-5 mr-2" /> All Matches
               </button>
               <button
                 onClick={handleOpenSettingsModal}
                 className="p-2.5 bg-brand-dark text-white hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out"
                 aria-label="Open settings"
                 title="Settings"
               >
                 <Settings className="w-5 h-5" />
               </button>
             </div>
           </div>
         )}

         {/* All Matches Page Back Button (desktop only) */}
         {currentPage === 'allMatches' && (
           <div className="hidden md:flex items-center justify-center mb-6">
             <button
               onClick={handleNavigateToMain}
               className="flex items-center justify-center px-5 py-2.5 bg-brand-dark text-white font-semibold hover:bg-brand-medium focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-brand-dark transition duration-150 ease-in-out rounded-lg shadow-md"
               title="Back to Main Page"
             >
               <ArrowLeft className="w-5 h-5 mr-2" /> Back to Main
             </button>
           </div>
         )}

        {/* Informative messages */}
         {!loading && !initError && allTeams.length > 0 && filteredTeams.length < 2 && (
           <p className="text-yellow-700 bg-yellow-100 p-3 rounded-sm mb-6 text-center max-w-md">
             Only {filteredTeams.length} team(s) match the current rating filter ({minRating.toFixed(1)} - {maxRating.toFixed(1)} stars{excludeNations ? ', excluding nations' : ''}). Need at least 2 to generate a match. Adjust settings.
           </p>
         )}
          {!loading && !initError && allTeams.length > 0 && filteredTeams.length >= 2 && !canGenerateNewMatch && (
           <p className="text-yellow-700 bg-yellow-100 p-3 rounded-sm mb-6 text-center max-w-md">
             All {filteredTeams.length} team(s) matching the filter{excludeNations ? ' (excluding nations)' : ''} have already played today. Cannot generate a new matchup.
           </p>
         )}
         {!loading && !initError && allTeams.length === 0 && (
           <p className="text-gray-600 mb-6 text-center mt-8">No teams available to display.</p>
         )}

         {/* Main Page Content */}
         {currentPage === 'main' && (
           <>
             {!loading && !initError && (
               <ErrorBoundary fallbackTitle="Error loading today's matches">
                 <CollapsibleSection title="Today's Matches" storageKey="section-todayMatches" badge={matchesToday.length} defaultOpen={true}>
                   <MatchHistory matchesToday={matchesToday} loading={loadingHistory} error={historyError} onRefresh={handleManualRefreshHistory} allPlayers={allPlayers} hideTitle />
                 </CollapsibleSection>
               </ErrorBoundary>
             )}

             {!loading && !initError && (
               <ErrorBoundary fallbackTitle="Error loading game sessions">
                 <CollapsibleSection title="Game Sessions" storageKey="section-gameSessions" defaultOpen={false}>
                   <GameSessions allMatches={allMatches} allPlayers={allPlayers} loading={loadingAllMatches} error={allMatchesError} hideTitle />
                 </CollapsibleSection>
               </ErrorBoundary>
             )}

             {!loading && !initError && (
               <ErrorBoundary fallbackTitle="Error loading standings">
                 <CollapsibleSection title="Player Standings (Today)" storageKey="section-standingsToday" defaultOpen={true}>
                   <PlayerStandings standings={playerStandings} loading={loadingHistory} error={historyError} title="Player Standings (Today)" matches={matchesToday} hideTitle />
                 </CollapsibleSection>
               </ErrorBoundary>
             )}

             {!loading && !initError && (
               <ErrorBoundary fallbackTitle="Error loading overall standings">
                 <CollapsibleSection title="Player Standings (Overall)" storageKey="section-standingsOverall" defaultOpen={false}>
                   <PlayerStandings
                      standings={overallPlayerStandings}
                      loading={loadingAllMatches}
                      error={allMatchesError}
                      title="Player Standings (Overall)"
                      matches={allMatches}
                      allPlayers={allPlayers}
                      allTeams={allTeams}
                      enableVersionFilter={true}
                      hideTitle
                    />
                 </CollapsibleSection>
               </ErrorBoundary>
             )}

             {!loading && !initError && (
               <ErrorBoundary fallbackTitle="Error loading player top teams">
                 <CollapsibleSection title="Top 3 Teams per Player" storageKey="section-playerTopTeams" defaultOpen={false}>
                   <PlayerTopTeams
                      allPlayers={allPlayers}
                      allMatches={allMatches}
                      allTeams={allTeams}
                      loading={loadingAllMatches}
                      error={allMatchesError}
                      hideTitle
                    />
                 </CollapsibleSection>
               </ErrorBoundary>
             )}

             {!loading && !initError && (
               <ErrorBoundary fallbackTitle="Error loading win percentage teams">
                 <CollapsibleSection title="Top Win % Teams" storageKey="section-topWin" defaultOpen={false}>
                   <TopWinPercentageTeams teamStandings={teamStatistics} loading={loadingAllMatches} error={allMatchesError} allMatches={allMatches} hideTitle />
                 </CollapsibleSection>
               </ErrorBoundary>
             )}

             {!loading && !initError && (
               <ErrorBoundary fallbackTitle="Error loading loss percentage teams">
                 <CollapsibleSection title="Top Loss % Teams" storageKey="section-topLoss" defaultOpen={false}>
                   <TopLossPercentageTeams teamStandings={teamStatistics} loading={loadingAllMatches} error={allMatchesError} allMatches={allMatches} hideTitle />
                 </CollapsibleSection>
               </ErrorBoundary>
             )}

             {!loading && !initError && (
               <ErrorBoundary fallbackTitle="Error loading head-to-head matrix">
                 <CollapsibleSection title="Head-to-Head Matrix" storageKey="section-winMatrix" defaultOpen={false}>
                   <PlayerWinMatrix allPlayers={allPlayers} allMatches={allMatches} loading={loadingAllMatches} error={allMatchesError} hideTitle />
                 </CollapsibleSection>
               </ErrorBoundary>
             )}

             {!loading && !initError && (
               <ErrorBoundary fallbackTitle="Error loading achievements">
                 <CollapsibleSection title="Player Achievements" storageKey="section-achievements" defaultOpen={false}>
                   <PlayerAchievements allMatches={allMatches} allPlayers={allPlayers} allTeams={allTeams} loading={loadingAllMatches} error={allMatchesError} />
                 </CollapsibleSection>
               </ErrorBoundary>
             )}

              <AdminOnly>
               {!loading && !initError && (
                 <ErrorBoundary fallbackTitle="Error loading user management">
                   <CollapsibleSection title="User Management" storageKey="section-userManagement" defaultOpen={false}>
                     <UserManagement />
                   </CollapsibleSection>
                 </ErrorBoundary>
               )}
             </AdminOnly>
           </>
         )}

         {/* All Matches Page Content */}
         {currentPage === 'allMatches' && (
           <ErrorBoundary fallbackTitle="Error loading all matches">
             <AllMatches
               allMatches={allMatches}
               loading={loadingAllMatches}
               error={allMatchesError}
               onRefresh={handleRefreshAllMatches}
               allPlayers={allPlayers}
             />
           </ErrorBoundary>
         )}
      </main>

      {/* Modals */}
      <EditTeamModal isOpen={isEditModalOpen} onClose={handleCloseEditModal} allTeams={filteredTeams.filter(team => !playedTeamIdsToday.has(team.id))} onTeamSelected={handleTeamSelected} currentTeam={editingTeamIndex !== null && match ? match[editingTeamIndex] : undefined} />
      <SettingsModal
        isOpen={isSettingsModalOpen}
        onClose={handleCloseSettingsModal}
        onSave={handleSaveSettings}
        initialMinRating={minRating}
        initialMaxRating={maxRating}
        initialExcludeNations={excludeNations}
        initialSelectedVersion={selectedVersion}
        initialMaxOvrDiff={maxOvrDiff}
        allPlayers={allPlayers}
        onUpdatePlayerName={handleUpdatePlayerName}
      />
       <AddMatchModal
         isOpen={isAddMatchModalOpen}
         onClose={handleCloseAddMatchModal}
         matchTeams={match}
         onMatchSaved={handleMatchSaved}
         initialTeam1Players={initialMatchPlayers?.team1Players}
         initialTeam2Players={initialMatchPlayers?.team2Players}
       />
      {/* Bottom Navigation (mobile only) */}
      {!loading && !initError && allTeams.length > 0 && (
        <BottomNav
          onNewMatchup={() => handleGenerateNewMatch()}
          onAddMatch={handleOpenAddMatchModal}
          onAllMatches={handleNavigateToAllMatches}
          onSettings={handleOpenSettingsModal}
          onBackToMain={handleNavigateToMain}
          canGenerateNewMatch={canGenerateNewMatch}
          hasMatch={!!match}
          isAdmin={isAdmin}
          currentPage={currentPage}
        />
      )}
      </AuthWrapper>
    </div>
  );
}

export default App;
