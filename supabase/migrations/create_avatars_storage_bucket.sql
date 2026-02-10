/*
  # Create avatars storage bucket

  This migration creates the 'avatars' storage bucket for player avatars
  and sets up the necessary RLS policies.

  1. Storage Bucket
     - Create 'avatars' bucket if it doesn't exist
     - Make it public for reading

  2. Security Policies
     - Allow authenticated users to upload avatars
     - Allow public read access to avatars
     - Allow authenticated users to delete avatars
*/

-- Create the avatars bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update avatars" ON storage.objects;

-- Allow authenticated users to upload avatars
CREATE POLICY "Allow authenticated users to upload avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars');

-- Allow public read access to avatars
CREATE POLICY "Allow public read access to avatars"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'avatars');

-- Allow authenticated users to delete avatars
CREATE POLICY "Allow authenticated users to delete avatars"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'avatars');

-- Allow authenticated users to update avatars
CREATE POLICY "Allow authenticated users to update avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars')
  WITH CHECK (bucket_id = 'avatars');
