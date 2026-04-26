-- T1-foundation migration 009: app_writer role + append-only trigger (ADR-005)

-- Append-only trigger: blocks ALL UPDATE/DELETE on transactions and consents
CREATE OR REPLACE FUNCTION transactions_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'transactions is append-only (ADR-005). Use reverses_transaction_id for corrections.';
END;
$$;

CREATE TRIGGER transactions_no_update
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION transactions_immutable();

CREATE TRIGGER transactions_no_delete
BEFORE DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION transactions_immutable();

CREATE OR REPLACE FUNCTION consents_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'consents is append-only (PIPA legal record).';
END;
$$;

CREATE TRIGGER consents_no_update
BEFORE UPDATE ON consents
FOR EACH ROW EXECUTE FUNCTION consents_immutable();

CREATE TRIGGER consents_no_delete
BEFORE DELETE ON consents
FOR EACH ROW EXECUTE FUNCTION consents_immutable();

-- Note: the dedicated `app_writer` Postgres role is created in Supabase dashboard
-- (Database → Roles) since CREATE ROLE requires SUPERUSER. The migration documents
-- the intended permission set; application of GRANT/REVOKE happens during prod setup.
--
-- Intended grants for app_writer (apply manually after role creation):
--   GRANT USAGE ON SCHEMA public TO app_writer;
--   GRANT SELECT, INSERT ON families, memberships, consents, claim_attempts TO app_writer;
--   GRANT SELECT, INSERT, UPDATE ON accounts TO app_writer;  -- for cached balance
--   GRANT SELECT, INSERT ON transactions TO app_writer;
--   REVOKE UPDATE, DELETE ON transactions FROM app_writer;
--   GRANT SELECT, INSERT ON weekly_snapshots TO app_writer;
--   GRANT EXECUTE ON FUNCTION process_claim, create_family_with_kid, reconcile_balance TO app_writer;

COMMENT ON FUNCTION transactions_immutable() IS 'ADR-005 belt-and-suspenders: trigger blocks UPDATE/DELETE even from service_role';
