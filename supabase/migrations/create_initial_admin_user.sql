/*
  # Create Initial Admin User

  This migration creates an initial admin user for the application.
  This should be run after the user_profiles table is created.

  Note: This creates a user account that can be used to bootstrap the system.
  The email and password should be changed after first login.
*/

-- Insert initial admin user
-- Note: This will only work if the user doesn't already exist
-- The user will need to sign up through the application first, then this profile will be created

-- Create a function to create admin profile for a user
CREATE OR REPLACE FUNCTION public.create_admin_profile(user_email text)
RETURNS void AS $$
DECLARE
  user_id uuid;
BEGIN
  -- Get the user ID from auth.users table
  SELECT id INTO user_id
  FROM auth.users
  WHERE email = user_email;

  -- If user exists, create admin profile
  IF user_id IS NOT NULL THEN
    INSERT INTO public.user_profiles (id, role)
    VALUES (user_id, 'admin')
    ON CONFLICT (id) DO UPDATE SET
      role = 'admin',
      updated_at = now();
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: To create the initial admin user, you'll need to:
-- 1. Have a user sign up through the application first
-- 2. Then run: SELECT public.create_admin_profile('admin@example.com');
-- Replace 'admin@example.com' with the actual admin email address