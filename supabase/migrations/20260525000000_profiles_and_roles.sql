-- =================================================================
-- Migration: profiles_and_roles
-- Phase 1: introduce profiles table, role column, auto-provisioning
--          trigger, and user_role() helper.
--
-- Notes:
--   * RLS is intentionally NOT enabled in this phase.
--   * Route guards and UI gating are intentionally NOT changed.
--   * All statements are written to be idempotent.
-- =================================================================


-- =================================================================
-- profiles
-- One row per auth.users row. id is a FK to auth.users(id).
-- =================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email         text,
  full_name     text,
  role          text        NOT NULL DEFAULT 'basic',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Role constraint (idempotent: drop-if-exists then add).
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS chk_profiles_role;
ALTER TABLE profiles
  ADD CONSTRAINT chk_profiles_role
  CHECK (role IN ('admin', 'supervisor', 'production_planner', 'basic'));

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles (role);

-- Keep updated_at fresh via the shared trigger from the initial schema.
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- =================================================================
-- handle_new_user
-- Auto-create a profile row whenever a new auth.users row is inserted.
-- SECURITY DEFINER so it can write into public.profiles regardless of
-- the caller. search_path is pinned to avoid hijacking.
-- =================================================================
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
    'basic'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger on auth.users. Recreate idempotently.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();


-- =================================================================
-- user_role()
-- Helper to return the current authenticated user's role. Returns
-- NULL when there is no auth.uid() (e.g. service role / anon).
-- STABLE + SECURITY DEFINER so RLS policies (added in a later phase)
-- can call it without recursing into profiles policies.
-- =================================================================
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;


-- =================================================================
-- Backfill: ensure every existing auth.users row has a profile.
-- Defaults to 'basic' (least privilege). No-op for users that already
-- have a profile thanks to ON CONFLICT.
-- =================================================================
INSERT INTO public.profiles (id, email, full_name, role)
SELECT
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data ->> 'full_name', NULL),
  'basic'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;
