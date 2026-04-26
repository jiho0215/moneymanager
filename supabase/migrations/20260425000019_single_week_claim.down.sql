-- Rollback to back-claim model (re-apply migration 018's process_claim).
DROP FUNCTION IF EXISTS process_claim(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB);
