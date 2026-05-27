-- =================================================================
-- Migration: rename_new_to_pending
-- Brings the remote DB (which has the old role_new migration applied
-- at version 20260526000001) in line with the local final state where
-- the temporary 'new' role has been renamed to 'pending'.
--
-- Idempotent in both directions:
--   * Against remote — UPDATE flips existing 'new' rows, then the
--     CHECK / DEFAULT / trigger are reinstalled with 'pending'.
--   * Against a fresh local (where the squashed 20260526000001
--     already installed 'pending') — UPDATE matches zero rows; the
--     CHECK / DEFAULT / trigger statements re-install the same shape
--     and are no-ops.
--
-- Order matters: UPDATE existing rows BEFORE swapping the CHECK,
-- otherwise the new constraint would reject pre-existing 'new' rows.
-- =================================================================

-- 1. Backfill: any rows still labelled 'new' become 'pending'
UPDATE public.profiles SET role = 'pending' WHERE role = 'new';

-- 2. CHECK constraint: drop 'new', ensure 'pending'
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

-- 3. Column default for new sign-ups
ALTER TABLE profiles ALTER COLUMN role SET DEFAULT 'pending';

-- 4. Trigger function: new auth.users → profile with role='pending'
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
