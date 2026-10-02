import React, { useEffect, useMemo, useState } from 'react';
import { Dices } from 'lucide-react';
import { Team } from '../types';
import { BottomSheet, Button, Select } from './ui';

interface EditTeamModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Already filtered to the current rating/version/nation settings, minus teams played today. */
  availableTeams: Team[];
  onTeamSelected: (team: Team) => void;
  currentTeam?: Team;
}

const EditTeamModal: React.FC<EditTeamModalProps> = ({
  isOpen,
  onClose,
  availableTeams,
  onTeamSelected,
  currentTeam,
}) => {
  const [selectedLeague, setSelectedLeague] = useState<string | null>(null);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const leagueStillAvailable = currentTeam && availableTeams.some(t => t.league === currentTeam.league);
      const teamStillAvailable = currentTeam && availableTeams.some(t => t.id === currentTeam.id);
      setSelectedLeague(leagueStillAvailable ? currentTeam!.league : null);
      setSelectedTeamId(teamStillAvailable ? currentTeam!.id : null);
    } else {
      setSelectedLeague(null);
      setSelectedTeamId(null);
    }
    // Only re-derive when the sheet opens/closes or the reference team changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, currentTeam?.id]);

  const leagues = useMemo(
    () => Array.from(new Set(availableTeams.map(t => t.league))).sort(),
    [availableTeams]
  );
  const teamsInLeague = useMemo(
    () => (selectedLeague ? availableTeams.filter(t => t.league === selectedLeague).sort((a, b) => a.name.localeCompare(b.name)) : []),
    [availableTeams, selectedLeague]
  );

  const handleRandomize = () => {
    if (availableTeams.length === 0) return;
    const team = availableTeams[Math.floor(Math.random() * availableTeams.length)];
    onTeamSelected(team);
    onClose();
  };

  const handleSelect = () => {
    const team = availableTeams.find(t => t.id === selectedTeamId);
    if (team) {
      onTeamSelected(team);
      onClose();
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title={currentTeam ? `Choose Team (${currentTeam.name})` : 'Choose Team'}>
      <Button variant="primary" className="mb-4 w-full" onClick={handleRandomize} disabled={availableTeams.length === 0}>
        <Dices className="h-4 w-4" />
        Randomize
      </Button>

      <p className="mb-4 text-center text-xs font-bold uppercase tracking-wide text-gray-400">- or -</p>

      <div className="mb-4">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-(--color-ink)">League</span>
        <Select
          value={selectedLeague ?? ''}
          onChange={e => { setSelectedLeague(e.target.value || null); setSelectedTeamId(null); }}
          disabled={leagues.length === 0}
        >
          <option value="">-- Select a league --</option>
          {leagues.map(league => <option key={league} value={league}>{league}</option>)}
        </Select>
        {leagues.length === 0 && (
          <p className="mt-1 text-[11px] text-yellow-700">No leagues available in the current filter.</p>
        )}
      </div>

      <div className="mb-4">
        <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-(--color-ink)">Team</span>
        <Select
          value={selectedTeamId ?? ''}
          onChange={e => setSelectedTeamId(e.target.value || null)}
          disabled={!selectedLeague || teamsInLeague.length === 0}
        >
          <option value="">-- Select a team --</option>
          {teamsInLeague.map(team => (
            <option key={team.id} value={team.id}>{team.name} ({team.overallRating})</option>
          ))}
        </Select>
        {selectedLeague && teamsInLeague.length === 0 && (
          <p className="mt-1 text-[11px] text-red-600">No teams found for this league in the current filter.</p>
        )}
      </div>

      <Button variant="outline" className="w-full" onClick={handleSelect} disabled={!selectedTeamId}>
        Select Team
      </Button>
    </BottomSheet>
  );
};

export default EditTeamModal;
