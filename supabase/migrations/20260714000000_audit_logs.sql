-- =================================================================
-- Migration: audit_logs
--
-- A single append-only audit trail for the three data-entry tables that
-- carry the packaging plant's operational numbers:
--   * primal_orders        (PK: work_date, sku    -> "work_date:sku")
--   * hog_intake_records    (PK: intake_date       -> "intake_date")
--   * primal_ending_stock   (PK: id (uuid)         -> "id")
--
-- Logging is done entirely in the database via ONE generic AFTER trigger
-- function attached to each table — there is deliberately no app-level
-- logging, so every write path (UI upsert, SQL console, seed script) is
-- captured uniformly. The schema is intentionally small: no record_label,
-- no free-form metadata.
--
-- Notes:
--   * record_audit_log() runs SECURITY DEFINER so it can read profiles for
--     the actor email and write into audit_logs regardless of the caller's
--     privileges. search_path is pinned to public to avoid hijacking.
--   * When AUTH_ENABLED=false (prototype mode) every request uses the anon
--     key, so auth.uid() is NULL. The function tolerates this: user_id and
--     user_email are simply left NULL. No branch fails on a missing user.
--   * Recursion is avoided by construction — audit_logs itself has NO
--     trigger, and only the three tables above do.
--   * RLS is intentionally NOT enabled in this phase (mirrors the sibling
--     tables). SEE the security phase before production exposure — the anon
--     key can otherwise read this trail. Reads are admin-facing UI only.
--   * All statements are idempotent.
-- =================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- Actor at write time. NULL when auth.uid() is unavailable
  -- (AUTH_ENABLED=false / anon / service role). FK SET NULL keeps the row
  -- when a user is later deleted; user_email preserves who it was.
  user_id     uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  user_email  text,
  action      text        NOT NULL,
  table_name  text        NOT NULL,
  -- Table-specific primary key, composed as text (see record_audit_log).
  record_id   text,
  old_data    jsonb,
  new_data    jsonb,
  source      text        NOT NULL DEFAULT 'web'
);

-- action is constrained to the three DML verbs (idempotent add).
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS chk_audit_logs_action;
ALTER TABLE audit_logs
  ADD CONSTRAINT chk_audit_logs_action
  CHECK (action IN ('insert', 'update', 'delete'));

-- Default sort is created_at DESC; a descending index serves it and the
-- date-range filter directly.
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
  ON audit_logs (created_at DESC);

-- The table filter is a plain equality lookup.
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name
  ON audit_logs (table_name);


-- =================================================================
-- record_audit_log
-- Generic AFTER INSERT/UPDATE/DELETE trigger function shared by all three
-- audited tables. Captures the actor, the action, and the full old/new
-- row as jsonb. Returns NULL (AFTER trigger: return value is ignored).
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


-- =================================================================
-- Attach the shared function to each audited table. Recreated
-- idempotently. audit_logs itself is deliberately left untriggered so
-- the trail cannot recurse.
-- =================================================================
DROP TRIGGER IF EXISTS trg_audit_primal_orders ON primal_orders;
CREATE TRIGGER trg_audit_primal_orders
AFTER INSERT OR UPDATE OR DELETE ON primal_orders
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_hog_intake_records ON hog_intake_records;
CREATE TRIGGER trg_audit_hog_intake_records
AFTER INSERT OR UPDATE OR DELETE ON hog_intake_records
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log();

DROP TRIGGER IF EXISTS trg_audit_primal_ending_stock ON primal_ending_stock;
CREATE TRIGGER trg_audit_primal_ending_stock
AFTER INSERT OR UPDATE OR DELETE ON primal_ending_stock
FOR EACH ROW
EXECUTE FUNCTION public.record_audit_log();
