export interface Team {
  id: string;
  name: string;
  league: string;
  rating: number; // Star rating (e.g., 4.5, 5.0)
  logoUrl: string; // URL of the team logo image
  overallRating: number; // e.g., 85, 90
  attackRating: number; // e.g., 88, 92
  midfieldRating: number; // e.g., 82, 87
  defendRating: number; // e.g., 80, 85
}
