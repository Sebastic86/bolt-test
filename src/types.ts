export interface Team {
  id: string;
  name: string;
  league: string;
  rating: number; // Star rating (e.g., 4.5, 5.0)
  logoUrl: string; // URL of the team logo image (or filename for local logos)
  overallRating: number; // e.g., 85, 90
  attackRating: number; // e.g., 88, 92
  midfieldRating: number; // e.g., 82, 87
  defendRating: number; // e.g., 80, 85
  version: string; // Version identifier (e.g., 'FC25')
  apiTeamId?: string | null; // TheSportsDB team ID for API logo fetching
  apiTeamName?: string | null; // Team name for API searches
  resolvedLogoUrl?: string | null; // Permanently stored API-resolved logo URL (eliminates API calls)
}

export interface Player {
  id: string;
  name: string;
  created_at: string;
}

// Represents a row from the 'matches' table
export interface Match {
  id: string;
  team1_id: string;
  team2_id: string;
  team1_score: number | null;
  team2_score: number | null;
  penalties_winner: 1 | 2 | null; // 1 for team1, 2 for team2, null if no penalties
  played_at: string;
  created_at: string;
}

// Represents a row from the 'match_players' table
export interface MatchPlayer {
    id: string;
    match_id: string;
    player_id: string;
    team_number: 1 | 2;
    created_at: string;
}

// Extended type for displaying match history easily
export interface MatchHistoryItem extends Match {
    team1_name: string;
    team1_logoUrl: string;
    team1_version: string;
    team2_name: string;
    team2_logoUrl: string;
    team2_version: string;
    team1_players: Player[];
    team2_players: Player[];
}

// Type for player standings data
export interface PlayerStanding {
  playerId: string;
  playerName: string;
  points: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number; // Added for sorting
  totalOverallRating: number; // Sum of overall ratings of teams played
  matchesPlayed: number; // Total number of matches played
}

// Type for team standings data
export interface TeamStanding {
  teamId: string;
  teamName: string;
  logoUrl: string;
  totalMatches: number;
  totalWins: number;
  totalLosses: number;
  winPercentage: number;
  lossPercentage: number;
}

// Authentication types
export interface UserProfile {
  id: string;
  role: 'admin' | 'normal';
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email?: string;
  profile?: UserProfile;
}

export interface AuthContextType {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAdmin: boolean;
  isNormalUser: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}
