DROP FUNCTION IF EXISTS next_sunday_kst();
-- Re-apply migration 018's create_family_with_kid + choose_cycle_end_action to revert.
DROP FUNCTION IF EXISTS create_family_with_kid(TEXT, UUID, TEXT, UUID, TEXT, SMALLINT, BIGINT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS choose_cycle_end_action(UUID, TEXT, BIGINT);
-- Shift active accounts back to Monday alignment:
UPDATE accounts
SET epoch_kst = epoch_kst + INTERVAL '1 day'
WHERE cycle_status = 'active'
  AND EXTRACT(DOW FROM (epoch_kst AT TIME ZONE 'Asia/Seoul')) = 0;
