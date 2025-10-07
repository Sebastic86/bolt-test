/*
  # Create Admin Function to List Users

  This migration creates a function that allows admin users to list all users
  from the auth.users table along with their profiles. This bypasses the need
  for service_role key on the client side.

  1. Changes
     - Creates a SECURITY DEFINER function that admins can call
     - Returns user information (id, email) from auth.users
     - Only callable by users with admin role

  2. Security
     - Uses SECURITY DEFINER to access auth.users table
     - Checks caller is admin before returning data
     - Does not expose sensitive auth data (hashed passwords, etc.)
*/

-- Create a function to list all users (for admins only)
CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check if the current user is an admin
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied. Admin privileges required.';
  END IF;

  -- Return user information from auth.users
  RETURN QUERY
  SELECT
    au.id,
    au.email::text,
    au.created_at,
    au.last_sign_in_at
  FROM auth.users au
  ORDER BY au.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (function checks admin internally)
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;
