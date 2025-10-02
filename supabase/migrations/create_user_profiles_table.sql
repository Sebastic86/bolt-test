/*
  # Create User Profiles Table for Role-Based Access Control

  This migration creates the user_profiles table to store user role information
  and updates RLS policies to support role-based access control while maintaining
  public read access for unauthenticated users.

  1. Changes
     - Creates user_profiles table with role-based structure
     - Updates RLS policies to support admin/normal user roles
     - Maintains public read access for existing functionality

  2. Security
     - Only authenticated users can have profiles
     - Admin users can perform all operations
     - Normal users have read-only access
     - Public users maintain current read access
*/

-- Enable RLS on auth.users if not already enabled
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('admin', 'normal')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create a security definer function to check if user is admin (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create policies for user_profiles table
-- Allow users to read their own profile
CREATE POLICY "Users can view own profile"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Allow admins to view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- Allow admins to insert new profiles
CREATE POLICY "Admins can create profiles"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Allow admins to update profiles
CREATE POLICY "Admins can update profiles"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Allow admins to delete profiles
CREATE POLICY "Admins can delete profiles"
  ON public.user_profiles
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Update existing table policies to support role-based access

-- Update players table policies
-- Keep public read access
-- Add admin-only write access
DROP POLICY IF EXISTS "Allow authenticated users to insert players" ON public.players;
DROP POLICY IF EXISTS "Allow authenticated users to update players" ON public.players;

CREATE POLICY "Admins can insert players"
  ON public.players
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update players"
  ON public.players
  FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Update matches table policies
-- Keep public read access
-- Add admin-only write access
DROP POLICY IF EXISTS "Allow authenticated users to insert matches" ON public.matches;
DROP POLICY IF EXISTS "Allow authenticated users to update matches" ON public.matches;

CREATE POLICY "Admins can insert matches"
  ON public.matches
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update matches"
  ON public.matches
  FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Update match_players table policies
-- Keep public read access
-- Add admin-only write access
DROP POLICY IF EXISTS "Allow authenticated users to insert match players" ON public.match_players;

CREATE POLICY "Admins can insert match players"
  ON public.match_players
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

-- Update teams table policies (if they exist)
-- Keep public read access for teams
-- Add admin-only write access for teams
DROP POLICY IF EXISTS "Allow authenticated users to update teams" ON public.teams;

CREATE POLICY "Admins can update teams"
  ON public.teams
  FOR UPDATE
  TO authenticated
  USING (public.is_admin());

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for user_profiles updated_at
CREATE TRIGGER handle_user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS user_profiles_role_idx ON public.user_profiles(role);
CREATE INDEX IF NOT EXISTS user_profiles_created_at_idx ON public.user_profiles(created_at);