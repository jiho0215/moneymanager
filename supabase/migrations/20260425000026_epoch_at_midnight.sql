-- Migration 026: pin cycle epoch to today's midnight in KST.
-- Previously next_sunday_kst() returned NOW() (the exact signup instant);
-- now it returns the start of today in KST so the cycle aligns to whole days.
-- Wait between signup and first claim is roughly 7 days (sub-day depending on
-- signup time, but always ends at the same hour of day each subsequent week).

CREATE OR REPLACE FUNCTION next_sunday_kst() RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul');
END;
$$;

-- Pull active accounts that haven't started yet to today's midnight too.
UPDATE accounts SET epoch_kst = date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul')
WHERE setup_state = 'active'
  AND last_claimed_week_num IS NULL
  AND week_num_started = 0
  AND epoch_kst > NOW();

COMMENT ON FUNCTION next_sunday_kst IS 'Cycle epoch = today 00:00 KST. Cycle is no longer Sunday-anchored; ritual day = signup day.';
