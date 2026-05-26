-- =================================================================
-- Migration: role_pending
-- Adds the 'pending' role to the auth/permissions model:
--   * extends profiles.role CHECK to include 'pending'
--   * flips column DEFAULT to 'pending' (new sign-ups land here)
--   * updates handle_new_user() to insert 'pending'
--
-- Existing rows are intentionally not touched.
-- Idempotent: drop-then-add for the constraint, OR REPLACE for the
-- trigger function, SET DEFAULT is itself idempotent.
-- =================================================================

-- 1. CHECK constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_role;

ALTER TABLE profiles
  ADD CONSTRAINT chk_profiles_role
  CHECK (role IN (
    'admin',
    'supervisor',
    'production_planner',
    'basic',
    'pending'
  ));

-- 2. Column default for new sign-ups
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'pending';

-- 3. Trigger function: new auth.users → profile with role='pending'
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NULL),
    'pending'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
