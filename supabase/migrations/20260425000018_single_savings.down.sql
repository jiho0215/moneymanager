-- Rollback to three-zone model: re-apply 013/014/015 definitions
-- Note: data is not migrated; rollback only restores function bodies.
-- Run migrations 013, 014, 015 in order to fully restore.

-- This file intentionally only drops functions; re-apply the originals.
DROP FUNCTION IF EXISTS process_claim(UUID, INTEGER, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS process_deposit(UUID, BIGINT, TEXT);
DROP FUNCTION IF EXISTS create_family_with_kid(TEXT, UUID, TEXT, UUID, TEXT, SMALLINT, BIGINT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS choose_cycle_end_action(UUID, TEXT, BIGINT);
