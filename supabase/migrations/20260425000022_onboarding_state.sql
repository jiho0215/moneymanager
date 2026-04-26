-- Migration 022: onboarding state machine + parent recommendations
-- Three states for an account:
--   parent_setup_pending  → parent must set recommended capital/scenario/weeks
--   kid_setup_pending     → parent done, kid must confirm/adjust
--   active                → fully running
-- Existing accounts default to 'active' so nothing changes for them.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS setup_state TEXT NOT NULL DEFAULT 'active'
    CHECK (setup_state IN ('parent_setup_pending', 'kid_setup_pending', 'active')),
  ADD COLUMN IF NOT EXISTS total_weeks INTEGER NOT NULL DEFAULT 8
    CHECK (total_weeks BETWEEN 1 AND 52),
  ADD COLUMN IF NOT EXISTS scenario TEXT NOT NULL DEFAULT 'one-time'
    CHECK (scenario IN ('one-time', 'regular')),
  ADD COLUMN IF NOT EXISTS recommended_starting_capital BIGINT,
  ADD COLUMN IF NOT EXISTS recommended_total_weeks INTEGER,
  ADD COLUMN IF NOT EXISTS recommended_scenario TEXT
    CHECK (recommended_scenario IS NULL OR recommended_scenario IN ('one-time', 'regular'));

-- 1) create_family_with_kid: skip the initial-deposit + week-0 snapshot when
--    the account is created in 'parent_setup_pending'. Real deposit happens
--    later in finalize_kid_choices.
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
  p_setup_state TEXT DEFAULT 'active'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_kid_membership_id UUID;
  v_account_id UUID;
  v_epoch_kst TIMESTAMPTZ;
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

  INSERT INTO families (name) VALUES (p_family_name) RETURNING id INTO v_family_id;
  INSERT INTO consents (family_id, accepted_by_user_id, consent_text, consent_version, ip_address, user_agent)
  VALUES (v_family_id, p_guardian_user_id, p_consent_text, p_consent_version, p_consent_ip, p_consent_ua);
  INSERT INTO memberships (family_id, user_id, role, display_name)
  VALUES (v_family_id, p_guardian_user_id, 'guardian', p_guardian_display_name);
  INSERT INTO memberships (family_id, user_id, role, display_name, age_tier, grade)
  VALUES (v_family_id, p_kid_user_id, 'kid', p_kid_nickname, v_tier, p_kid_grade)
  RETURNING id INTO v_kid_membership_id;

  v_epoch_kst := next_sunday_kst();

  INSERT INTO accounts (
    membership_id, starting_capital, free_balance, experiment_balance,
    epoch_kst, week_num_started, setup_state
  ) VALUES (
    v_kid_membership_id, p_starting_capital, p_starting_capital, 0,
    v_epoch_kst, 0, p_setup_state
  ) RETURNING id INTO v_account_id;

  -- Only emit the initial deposit + week-0 snapshot when the account is going
  -- live immediately. Pending accounts get those once the kid finalizes.
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

-- 2) finalize_parent_recommendations: parent picks rec values, account moves
--    to 'kid_setup_pending'.
CREATE OR REPLACE FUNCTION finalize_parent_recommendations(
  p_account_id UUID,
  p_recommended_starting_capital BIGINT,
  p_recommended_scenario TEXT,
  p_recommended_total_weeks INTEGER,
  p_weekly_growth_rate_bp INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_state TEXT;
BEGIN
  IF p_recommended_starting_capital < 1000 OR p_recommended_starting_capital > 10000000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_capital');
  END IF;
  IF p_recommended_scenario NOT IN ('one-time', 'regular') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_scenario');
  END IF;
  IF p_recommended_total_weeks < 1 OR p_recommended_total_weeks > 52 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_weeks');
  END IF;
  IF p_weekly_growth_rate_bp < 0 OR p_weekly_growth_rate_bp > 5000 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_rate');
  END IF;

  SELECT setup_state INTO v_state FROM accounts WHERE id = p_account_id FOR UPDATE;
  IF v_state IS NULL THEN RAISE EXCEPTION 'account not found'; END IF;
  IF v_state NOT IN ('parent_setup_pending', 'kid_setup_pending') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_state', 'state', v_state);
  END IF;

  UPDATE accounts SET
    recommended_starting_capital = p_recommended_starting_capital,
    recommended_scenario = p_recommended_scenario,
    recommended_total_weeks = p_recommended_total_weeks,
    weekly_growth_rate_bp = p_weekly_growth_rate_bp,
    setup_state = 'kid_setup_pending',
    updated_at = NOW()
  WHERE id = p_account_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 3) finalize_kid_choices: kid confirms (within parent's bounds where locked),
--    account becomes 'active' with the real initial deposit and week-0 snapshot.
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

  UPDATE accounts SET
    starting_capital = p_starting_capital,
    free_balance = p_starting_capital,
    experiment_balance = 0,
    bonus_balance = 0,
    scenario = p_scenario,
    total_weeks = p_total_weeks,
    epoch_kst = next_sunday_kst(),
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

COMMENT ON COLUMN accounts.setup_state IS 'parent_setup_pending → kid_setup_pending → active';
COMMENT ON FUNCTION finalize_parent_recommendations IS 'Parent picks recommended capital/scenario/weeks/rate; advances state to kid_setup_pending';
COMMENT ON FUNCTION finalize_kid_choices IS 'Kid confirms; emits initial_deposit + week-0 snapshot, advances state to active';
