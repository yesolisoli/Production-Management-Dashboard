-- =================================================================
-- Migration: employee_self_service_linking
-- Adds the columns the employee mobile app needs to link Supabase
-- auth users to employee records. Additive and nullable — existing
-- employee rows remain valid and unlinked until an email is set or
-- an admin links them.
--
--   auth.users.id → employees.auth_user_id → employee_daily_statuses.employee_id
--
-- Idempotent. No data is modified.
-- =================================================================

-- 1. Permanent identity link. Nullable; not all employees need linking
--    immediately. ON DELETE SET NULL so deleting an auth user never
--    deletes an employee.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS auth_user_id uuid
    REFERENCES auth.users (id) ON DELETE SET NULL;

-- One auth user can be linked to at most one employee, and vice versa.
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_auth_user_id
  ON public.employees (auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 2. Company-approved email used ONLY for the initial server-side
--    auto-link (verified session email → employee). The permanent
--    relationship is auth_user_id, never email.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS email text;

-- Normalize on write: unique on lower(trim(email)). Duplicate emails
-- would make auto-linking ambiguous; this prevents them at the source.
CREATE UNIQUE INDEX IF NOT EXISTS uq_employees_email_normalized
  ON public.employees (lower(btrim(email)))
  WHERE email IS NOT NULL;
