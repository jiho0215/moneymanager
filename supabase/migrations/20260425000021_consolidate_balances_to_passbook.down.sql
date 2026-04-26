-- Rollback: data cannot be reversed (would require re-applying old 80/20 split).
-- Only drop the new function bodies; re-apply migrations 010 to restore old reconcile/recompute.
DROP FUNCTION IF EXISTS reconcile_balance(UUID);
DROP FUNCTION IF EXISTS recompute_balance(UUID);
