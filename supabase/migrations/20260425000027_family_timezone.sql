-- Migration 027: per-family timezone.
-- Each family picks a single IANA timezone (default 'Asia/Seoul'). The cycle
-- epoch and the "today midnight" used by reset_today / choose_cycle_end_action /
-- finalize_kid_choices are computed in that timezone.

ALTER TABLE families
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Seoul';

-- Helper: returns the start of today (00:00) in the given IANA timezone, as a
-- TIMESTAMPTZ. The double AT TIME ZONE round-trip is the standard Postgres
-- pattern for "midnight in TZ X".
CREATE OR REPLACE FUNCTION today_midnight_in_tz(p_tz TEXT) RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN (date_trunc('day', NOW() AT TIME ZONE p_tz)) AT TIME ZONE p_tz;
END;
$$;

-- Backwards-compat shim: the old next_sunday_kst() is still referenced from
-- earlier migrations' bodies. Rewrite it to defer to today_midnight_in_tz with
-- the KST default. Real callers below now look up the family's TZ instead.
CREATE OR REPLACE FUNCTION next_sunday_kst() RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE AS $$
BEGIN
  RETURN today_midnight_in_tz('Asia/Seoul');
END;
$$;

-- create_family_with_kid: accepts a timezone and stores it on the family row.
-- The cycle epoch uses that timezone's midnight.
CREATE OR REPLACE FUNCTION create_family_with_kid(
  p_family_name TEXT,
  p_guardian_user_id UUID,
  p_guardian_display_name TEXT,
  p_kid_user_id UUID,
  p_kid_nickname TEXT,
  p_kid_grade SMALLINT,
  p_starting_capital BIGINT,
  p_consent_text TEXT,
  p_consent_version TEXT,
  p_consent_ip TEXT DEFAULT NULL,
  p_consent_ua TEXT DEFAULT NULL,
  p_setup_state TEXT DEFAULT 'active',
  p_timezone TEXT DEFAULT 'Asia/Seoul'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_kid_membership_id UUID;
  v_account_id UUID;
  v_epoch TIMESTAMPTZ;
  v_tier age_tier;
BEGIN
  IF p_starting_capital < 0 THEN RAISE EXCEPTION 'starting_capital must be non-negative'; END IF;
  IF p_setup_state NOT IN ('parent_setup_pending', 'kid_setup_pending', 'active') THEN
    RAISE EXCEPTION 'invalid setup_state: %', p_setup_state;
  END IF;
  IF p_kid_grade BETWEEN 1 AND 6 THEN v_tier := 'elementary';
  ELSIF p_kid_grade BETWEEN 7 AND 9 THEN v_tier := 'middle';
  ELSIF p_kid_grade BETWEEN 10 AND 12 THEN v_tier := 'high';
  ELSE RAISE EXCEPTION 'kid_grade must be 1-12'; END IF;

  -- Validate the timezone string by exercising it.
  PERFORM NOW() AT TIME ZONE p_timezone;

  INSERT INTO families (name, timezone) VALUES (p_family_name, p_timezone) RETURNING id INTO v_family_id;
  INSERT INTO consents (family_id, accepted_by_user_id, consent_text, consent_version, ip_address, user_agent)
    VALUES (v_family_id, p_guardian_user_id, p_consent_text, p_consent_version, p_consent_ip, p_consent_ua);
  INSERT INTO memberships (family_id, user_id, role, display_name)
    VALUES (v_family_id, p_guardian_user_id, 'guardian', p_guardian_display_name);
  INSERT INTO memberships (family_id, user_id, role, display_name, age_tier, grade)
    VALUES (v_family_id, p_kid_user_id, 'kid', p_kid_nickname, v_tier, p_kid_grade)
    RETURNING id INTO v_kid_membership_id;

  v_epoch := today_midnight_in_tz(p_timezone);

  INSERT INTO accounts (
    membership_id, starting_capital, free_balance, experiment_balance,
    epoch_kst, week_num_started, setup_state
  ) VALUES (
    v_kid_membership_id, p_starting_capital, p_starting_capital, 0,
    v_epoch, 0, p_setup_state
  ) RETURNING id INTO v_account_id;

  IF p_setup_state = 'active' THEN
    INSERT INTO transactions (account_id, transaction_type, zone, amount, week_num)
    VALUES (v_account_id, 'initial_deposit', 'free', p_starting_capital, 0);
    INSERT INTO weekly_snapshots (account_id, cycle_number, week_num, free_balance, experiment_balance, bonus_balance)
    VALUES (v_account_id, 1, 0, p_starting_capital, 0, 0);
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'family_id', v_family_id,
    'kid_membership_id', v_kid_membership_id,
    'account_id', v_account_id
  );
END;
$$;

-- choose_cycle_end_action: cycle reset epoch uses the family's timezone.
CREATE OR REPLACE FUNCTION choose_cycle_end_action(
  p_account_id UUID,
  p_action TEXT,
  p_new_starting_capital BIGINT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
  v_tz TEXT;
  v_new_epoch TIMESTAMPTZ;
BEGIN
  IF p_action NOT IN ('reset', 'extend', 'graduate') THEN
    RAISE EXCEPTION 'invalid action';
  END IF;

  SELECT * INTO v_account FROM accounts WHERE id = p_account_id FOR UPDATE;

  IF p_action = 'graduate' THEN
    UPDATE accounts SET cycle_status = 'graduated', updated_at = NOW() WHERE id = p_account_id;
    RETURN jsonb_build_object('ok', true, 'cycle_status', 'graduated');
  END IF;

  IF p_action = 'extend' THEN
    RETURN jsonb_build_object('ok', true, 'cycle_status', 'active', 'extended', true);
  END IF;

  IF p_new_starting_capital IS NULL OR p_new_starting_capital <= 0 THEN
    RAISE EXCEPTION 'reset requires new_starting_capital > 0';
  END IF;

  SELECT f.timezone INTO v_tz FROM accounts a
    JOIN memberships m ON m.id = a.membership_id
    JOIN families f ON f.id = m.family_id
    WHERE a.id = p_account_id;

  v_new_epoch := today_midnight_in_tz(COALESCE(v_tz, 'Asia/Seoul'));

  INSERT INTO transactions (account_id, transaction_type, zone, amount)
  VALUES (p_account_id, 'initial_deposit', 'free', p_new_starting_capital);

  UPDATE accounts SET
    cycle_number = cycle_number + 1,
    cycle_status = 'active',
    starting_capital = p_new_starting_capital,
    free_balance = p_new_starting_capital,
    experiment_balance = 0,
    bonus_balance = 0,
    pending_interest = 0,
    epoch_kst = v_new_epoch,
    week_num_started = 0,
    last_claimed_week_num = NULL,
    updated_at = NOW()
  WHERE id = p_account_id;

  INSERT INTO weekly_snapshots (account_id, cycle_number, week_num, free_balance, experiment_balance, bonus_balance)
  VALUES (p_account_id, v_account.cycle_number + 1, 0, p_new_starting_capital, 0, 0)
  ON CONFLICT (account_id, cycle_number, week_num) DO UPDATE SET
    free_balance = EXCLUDED.free_balance,
    experiment_balance = EXCLUDED.experiment_balance,
    bonus_balance = EXCLUDED.bonus_balance;

  RETURN jsonb_build_object('ok', true, 'cycle_status', 'active', 'cycle_number', v_account.cycle_number + 1);
END;
$$;

-- finalize_kid_choices: uses family timezone for epoch.
CREATE OR REPLACE FUNCTION finalize_kid_choices(
  p_account_id UUID,
  p_starting_capital BIGINT,
  p_scenario TEXT,
  p_total_weeks INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
  v_tz TEXT;
BEGIN
  IF p_starting_capital < 1000 OR p_starting_capital > 10000000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_capital');
  END IF;
  IF p_scenario NOT IN ('one-time', 'regular') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_scenario');
  END IF;
  IF p_total_weeks < 1 OR p_total_weeks > 52 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_weeks');
  END IF;

  SELECT * INTO v_account FROM accounts WHERE id = p_account_id FOR UPDATE;
  IF v_account IS NULL THEN RAISE EXCEPTION 'account not found'; END IF;
  IF v_account.setup_state <> 'kid_setup_pending' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_state', 'state', v_account.setup_state);
  END IF;

  SELECT f.timezone INTO v_tz FROM memberships m
    JOIN families f ON f.id = m.family_id
    WHERE m.id = v_account.membership_id;

  UPDATE accounts SET
    starting_capital = p_starting_capital,
    free_balance = p_starting_capital,
    experiment_balance = 0,
    bonus_balance = 0,
    scenario = p_scenario,
    total_weeks = p_total_weeks,
    epoch_kst = today_midnight_in_tz(COALESCE(v_tz, 'Asia/Seoul')),
    week_num_started = 0,
    last_claimed_week_num = NULL,
    setup_state = 'active',
    updated_at = NOW()
  WHERE id = p_account_id;

  INSERT INTO transactions (account_id, transaction_type, zone, amount, week_num)
  VALUES (p_account_id, 'initial_deposit', 'free', p_starting_capital, 0);

  INSERT INTO weekly_snapshots (account_id, cycle_number, week_num, free_balance, experiment_balance, bonus_balance)
  VALUES (p_account_id, v_account.cycle_number, 0, p_starting_capital, 0, 0)
  ON CONFLICT (account_id, cycle_number, week_num) DO UPDATE SET
    free_balance = EXCLUDED.free_balance,
    experiment_balance = EXCLUDED.experiment_balance,
    bonus_balance = EXCLUDED.bonus_balance;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Settings: parent updates the family's timezone.
CREATE OR REPLACE FUNCTION update_family_timezone(
  p_family_id UUID,
  p_timezone TEXT,
  p_actor_user_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Validate caller is a guardian of this family
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = p_actor_user_id AND family_id = p_family_id AND role = 'guardian'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_guardian');
  END IF;

  -- Validate the timezone string
  BEGIN
    PERFORM NOW() AT TIME ZONE p_timezone;
  EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_timezone');
  END;

  UPDATE families SET timezone = p_timezone WHERE id = p_family_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON COLUMN families.timezone IS 'IANA timezone (e.g. Asia/Seoul, America/Los_Angeles). Drives cycle epoch + UI date display.';
COMMENT ON FUNCTION today_midnight_in_tz IS 'Start of today (00:00) in the given IANA TZ as TIMESTAMPTZ.';
