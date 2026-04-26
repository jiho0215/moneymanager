-- Migration 025: drop Sunday anchoring entirely.
-- The cycle epoch is now the moment the kid finalizes onboarding (or
-- the parent creates the family for active-from-start accounts), and
-- the first claim is exactly 7 days later. The kid's "ritual day"
-- becomes whatever DOW they signed up on.
--
-- Function name stays for compat; it now returns the current KST timestamp
-- rather than a future Sunday. Callers (create_family_with_kid,
-- choose_cycle_end_action, finalize_kid_choices) get the new behaviour
-- without code changes.

CREATE OR REPLACE FUNCTION next_sunday_kst() RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE AS $$
BEGIN
  -- Returns the cycle start epoch = signup moment in KST.
  RETURN NOW() AT TIME ZONE 'Asia/Seoul';
END;
$$;

-- For active accounts that haven't started running yet (epoch still in the
-- future, no claims made), bring the epoch to NOW() so their 7-day countdown
-- begins from now instead of waiting for the next Sunday.
UPDATE accounts SET epoch_kst = NOW() AT TIME ZONE 'Asia/Seoul'
WHERE setup_state = 'active'
  AND last_claimed_week_num IS NULL
  AND week_num_started = 0
  AND epoch_kst > NOW();

COMMENT ON FUNCTION next_sunday_kst IS 'Cycle epoch = signup moment in KST. Name kept for backwards compatibility; cycle is no longer Sunday-anchored.';
