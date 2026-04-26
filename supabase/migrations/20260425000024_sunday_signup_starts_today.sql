-- Migration 024: Sunday-signup accounts start their cycle TODAY, not next Sunday.
-- Old next_sunday_kst() always advanced to the *next* Sunday, so a kid who
-- finished onboarding on a Sunday paid an extra 7 days of waiting before the
-- first claim. New formula: 0 days for Sunday, 1-6 days for other DOWs.

CREATE OR REPLACE FUNCTION next_sunday_kst() RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_now_kst TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Seoul';
  v_dow INT;
  v_days_until INT;
BEGIN
  v_dow := EXTRACT(DOW FROM v_now_kst)::INT;
  -- (7 - dow) % 7 → 0 for Sun, 6 for Mon, …, 1 for Sat
  v_days_until := (7 - v_dow) % 7;
  RETURN date_trunc('day', v_now_kst) + (v_days_until || ' days')::INTERVAL;
END;
$$;

-- Fix accounts that were created on a Sunday under the old formula:
-- epoch is currently exactly 7 days in the future, but it should have been today.
-- Only touches active accounts that haven't claimed yet.
UPDATE accounts SET epoch_kst = epoch_kst - INTERVAL '7 days'
WHERE setup_state = 'active'
  AND last_claimed_week_num IS NULL
  AND week_num_started = 0
  AND EXTRACT(DOW FROM (NOW() AT TIME ZONE 'Asia/Seoul')) = 0
  AND epoch_kst > NOW()
  AND (epoch_kst AT TIME ZONE 'Asia/Seoul')::DATE
    = ((NOW() AT TIME ZONE 'Asia/Seoul')::DATE + INTERVAL '7 days')::DATE;

COMMENT ON FUNCTION next_sunday_kst IS 'Returns the upcoming Sunday 00:00 KST. If today is Sunday, returns today 00:00.';
