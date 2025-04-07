/*
  # Seed initial team data (Updated for logoUrl)

  This migration inserts a few sample teams into the `teams` table to provide initial data for the application.
  It now uses `logoUrl` instead of `logoIconName`.

  1.  **Data Insertion:**
      - Inserts 10 sample teams with varying leagues, ratings, and **placeholder logo URLs** into the `public.teams` table.
      - **Important:** Replace placeholder URLs with actual ones.
*/

-- Clear existing data before seeding (optional, use with caution)
-- DELETE FROM public.teams;

-- Insert sample teams with logoUrl (using placeholders)
INSERT INTO public.teams (name, league, rating, "logoUrl", "overallRating", "attackRating", "midfieldRating", "defendRating") VALUES
('Manchester City', 'Premier League', 5.0, 'https://via.placeholder.com/64.png?text=Man+City', 92, 93, 91, 90),
('Real Madrid', 'La Liga', 5.0, 'https://via.placeholder.com/64.png?text=Real+Madrid', 91, 90, 90, 89),
('Bayern Munich', 'Bundesliga', 5.0, 'https://via.placeholder.com/64.png?text=Bayern', 90, 91, 89, 88),
('Paris Saint-Germain', 'Ligue 1', 4.5, 'https://via.placeholder.com/64.png?text=PSG', 88, 89, 87, 85),
('Liverpool', 'Premier League', 4.5, 'https://via.placeholder.com/64.png?text=Liverpool', 89, 90, 88, 87),
('Inter Milan', 'Serie A', 4.5, 'https://via.placeholder.com/64.png?text=Inter', 87, 88, 86, 87),
('FC Barcelona', 'La Liga', 4.5, 'https://via.placeholder.com/64.png?text=Barca', 86, 87, 85, 84),
('Arsenal', 'Premier League', 4.5, 'https://via.placeholder.com/64.png?text=Arsenal', 85, 86, 84, 84),
('Borussia Dortmund', 'Bundesliga', 4.0, 'https://via.placeholder.com/64.png?text=Dortmund', 84, 85, 83, 81),
('Juventus', 'Serie A', 4.0, 'https://via.placeholder.com/64.png?text=Juventus', 83, 82, 81, 85)
ON CONFLICT (name) DO NOTHING; -- Avoid inserting duplicates if script is run again
