import React from 'react';
import { MatchHistoryItem } from '../types';
import PlayerBadge from './PlayerBadge';

interface PlayerMatchDetailsProps {
  playerId: string;
  playerName: string;
  matches: MatchHistoryItem[];
  onClose: () => void;
}

const PlayerMatchDetails: React.FC<PlayerMatchDetailsProps> = ({
  playerId,
  playerName,
  matches,
  onClose
}) => {
  // Filter matches that include the selected player
  const playerMatches = matches.filter(match => 
    match.team1_players.some(player => player.id === playerId) ||
    match.team2_players.some(player => player.id === playerId)
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMatchResult = (match: MatchHistoryItem, playerId: string) => {
    if (match.team1_score === null || match.team2_score === null) {
      return 'No Score';
    }

    // Determine which team the player was on
    const isOnTeam1 = match.team1_players.some(player => player.id === playerId);
    const teamScore = isOnTeam1 ? match.team1_score : match.team2_score;
    const opponentScore = isOnTeam1 ? match.team2_score : match.team1_score;
    
    let result = 'Draw';
    if (teamScore > opponentScore) {
      result = 'Win';
    } else if (teamScore < opponentScore) {
      result = 'Loss';
    } else if (match.penalties_winner) {
      const wonPenalties = (isOnTeam1 && match.penalties_winner === 1) || 
                          (!isOnTeam1 && match.penalties_winner === 2);
      result = wonPenalties ? 'Win (P)' : 'Loss (P)';
    }

    return result;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-700">
              Matches for {playerName}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Showing {playerMatches.length} matches
          </p>
        </div>

        <div className="p-6 overflow-y-auto max-h-[70vh]">
          {playerMatches.length === 0 ? (
            <p className="text-center text-gray-500">No matches found for this player.</p>
          ) : (
            <div className="space-y-4">
              {playerMatches.map((match) => {
                const isOnTeam1 = match.team1_players.some(player => player.id === playerId);
                const playerTeam = isOnTeam1 ? {
                  name: match.team1_name,
                  logo: match.team1_logoUrl,
                  players: match.team1_players,
                  score: match.team1_score
                } : {
                  name: match.team2_name,
                  logo: match.team2_logoUrl,
                  players: match.team2_players,
                  score: match.team2_score
                };
                const opponent = isOnTeam1 ? {
                  name: match.team2_name,
                  logo: match.team2_logoUrl,
                  players: match.team2_players,
                  score: match.team2_score
                } : {
                  name: match.team1_name,
                  logo: match.team1_logoUrl,
                  players: match.team1_players,
                  score: match.team1_score
                };
                const result = getMatchResult(match, playerId);
                
                return (
                  <div key={match.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <div className="text-sm text-gray-500">
                        {formatDate(match.played_at)}
                      </div>
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                        result.startsWith('Win') ? 'bg-green-100 text-green-800' :
                        result.startsWith('Loss') ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {result}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Player's Team Info */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <img 
                            src={playerTeam.logo} 
                            alt={`${playerTeam.name} logo`}
                            className="h-6 w-6 object-contain mr-2"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                          <h4 className="font-medium text-gray-900">{playerTeam.name}</h4>
                        </div>
                        <div className="text-2xl font-bold text-blue-600 mb-2">
                          {playerTeam.score !== null ? playerTeam.score : '-'}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Teammates:</strong>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1 justify-center">
                          {playerTeam.players.length > 0 ? (
                            playerTeam.players.map((player, idx) => (
                              <div
                                key={player.id}
                                className={player.id === playerId ? 'ring-2 ring-blue-500 rounded-full' : ''}
                              >
                                <PlayerBadge player={player} size="xs" />
                              </div>
                            ))
                          ) : (
                            <span className="text-xs text-gray-500">No players recorded</span>
                          )}
                        </div>
                      </div>

                      {/* VS */}
                      <div className="text-center flex items-center justify-center">
                        <div className="text-lg font-bold text-gray-500">VS</div>
                      </div>

                      {/* Opponent Team Info */}
                      <div className="text-center">
                        <div className="flex items-center justify-center mb-2">
                          <img 
                            src={opponent.logo} 
                            alt={`${opponent.name} logo`}
                            className="h-6 w-6 object-contain mr-2"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.style.display = 'none';
                            }}
                          />
                          <h4 className="font-medium text-gray-900">{opponent.name}</h4>
                        </div>
                        <div className="text-2xl font-bold text-gray-700 mb-2">
                          {opponent.score !== null ? opponent.score : '-'}
                        </div>
                        <div className="text-sm text-gray-600">
                          <strong>Players:</strong>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1 justify-center">
                          {opponent.players.length > 0 ? (
                            opponent.players.map((player, idx) => (
                              <PlayerBadge key={player.id} player={player} size="xs" />
                            ))
                          ) : (
                            <span className="text-xs text-gray-500">No players recorded</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {match.penalties_winner && (
                      <div className="mt-3 text-center text-sm text-amber-700 bg-amber-50 py-2 rounded">
                        <strong>Won on Penalties</strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlayerMatchDetails;