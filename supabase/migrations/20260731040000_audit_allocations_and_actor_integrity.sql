-- =================================================================
-- Migration: audit_allocations_and_actor_integrity
-- Security hardening for the Production Planning domain, two parts:
--
-- 1) Audit coverage for primal_allocations (INSERT/UPDATE/DELETE),
--    closing the gap reported in the phase-3 RLS work. Reuses the
--    generic record_audit_log() — the function is CREATE OR REPLACEd
--    verbatim from 20260714000000 with ONE addition: a record_id
--    branch for primal_allocations (its uuid PK as text). Behavior for
--    every previously audited table is unchanged. DELETE events keep
--    the full removed row in old_data (existing behavior).
--
-- 2) Trusted actor stamping. hog_intake_records.updated_by and
--    primal_orders.updated_by were previously client-supplied, so an
--    authenticated user could record another user's UUID as the actor.
--    A BEFORE INSERT OR UPDATE trigger now overwrites the field with
--    auth.uid() whenever a JWT-authenticated caller writes.
--
--    When auth.uid() IS NULL (service role, SQL console, database
--    maintenance): the explicitly supplied value — usually NULL — is
--    preserved unchanged, so trusted backfills and repair scripts can
--    still stamp or clear the field deliberately. Client spoofing is
--    not a concern in that path: RLS (phase 3) only admits
--    authenticated admin/production_planner writes, which always carry
--    auth.uid(). No other planning table has an actor column
--    (primal_ending_stock and primal_allocations have none).
--
-- The frontend keeps sending updated_by for now; the trigger makes the
-- database authoritative, so a spoofed payload value is discarded.
--
-- Idempotent: CREATE OR REPLACE + guarded trigger drops.
-- =================================================================


-- =================================================================
-- record_audit_log — unchanged except the primal_allocations branch.
-- =================================================================
CREATE OR REPLACE FUNCTION public.record_audit_log()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_email text;
  v_old        jsonb;
  v_new        jsonb;
  v_key        jsonb;
  v_record_id  text;
BEGIN
  -- Resolve the actor email only when authenticated. Left NULL in
  -- prototype mode (auth.uid() NULL) or when no profile row exists.
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_new := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old := NULL;
    v_new := to_jsonb(NEW);
  ELSE
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
  END IF;

  -- Compose a stable text record id from each table's primary key, reading
  -- from whichever row image exists for this operation.
  v_key := COALESCE(v_new, v_old);
  v_record_id := CASE TG_TABLE_NAME
    WHEN 'primal_orders' THEN
      (v_key ->> 'work_date') || ':' || (v_key ->> 'sku')
    WHEN 'hog_intake_records' THEN
      (v_key ->> 'intake_date')
    WHEN 'primal_ending_stock' THEN
      (v_key ->> 'id')
    WHEN 'primal_allocations' THEN
      (v_key ->> 'id')
    ELSE NULL
  END;

  INSERT INTO public.audit_logs (
    user_id, user_email, action, table_name, record_id, old_data, new_data
  )
  VALUES (
    v_user_id,
    v_user_email,
    lower(TG_OP),
    TG_TABLE_NAME,
    v_record_id,
    v_old,
    v_new
  );

  RETURN NULL;
END;
$$;

-- Attach to primal_allocations (guarded, same shape as the siblings).
DROP TRIGGER IF EXISTS trg_audit_primal_allocations ON primal_allocations;
CREATE TRIGGER trg_audit_primal_allocations
AFTER INSERT OR UPDATE OR DELETE ON primal_allocations
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log();


-- =================================================================
-- set_updated_by_from_auth — stamp the actor from the JWT, never from
-- the client payload, whenever an authenticated user writes.
-- =================================================================
CREATE OR REPLACE FUNCTION public.set_updated_by_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hog_intake_set_updated_by ON hog_intake_records;
CREATE TRIGGER trg_hog_intake_set_updated_by
BEFORE INSERT OR UPDATE ON hog_intake_records
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by_from_auth();

DROP TRIGGER IF EXISTS trg_primal_orders_set_updated_by ON primal_orders;
CREATE TRIGGER trg_primal_orders_set_updated_by
BEFORE INSERT OR UPDATE ON primal_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_by_from_auth();
