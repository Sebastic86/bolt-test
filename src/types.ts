export interface Team {
  id: string;
  name: string;
  league: string;
  rating: number; // Star rating (e.g., 4.5, 5.0)
  logoIconName: string; // Name of the Lucide icon (e.g., 'ShieldCheck', 'Zap')
  overallRating: number; // e.g., 85, 90
  attackRating: number; // e.g., 88, 92
  midfieldRating: number; // e.g., 82, 87
  defendRating: number; // e.g., 80, 85
}
