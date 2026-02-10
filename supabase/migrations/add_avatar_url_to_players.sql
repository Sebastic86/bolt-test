/*
  # Add avatar_url column to players table

  This migration adds an avatar_url column to the players table to store
  player avatar images.

  1. Changes
     - Add `avatar_url` (text, nullable) to players table
     - Avatar URLs can point to Supabase storage or external URLs
*/

-- Add avatar_url column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add comment to explain the column
COMMENT ON COLUMN players.avatar_url IS 'URL to player avatar image (Supabase storage or external URL)';
