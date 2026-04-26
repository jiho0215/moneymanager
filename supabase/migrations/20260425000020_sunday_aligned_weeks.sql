-- Migration 020: Sunday-aligned weeks (was Monday)
-- 매주 일요일 00:00 KST에 새 청구 윈도우 열림. 한 주 동안 유효.

-- Helper to compute next Sunday 00:00 KST from a timestamp.
-- DOW: 0=Sun .. 6=Sat. Days-until-next-Sunday = ((6 - dow) % 7) + 1.
-- This always returns the *upcoming* Sunday, even if today is Sunday.
CREATE OR REPLACE FUNCTION next_sunday_kst() RETURNS TIMESTAMPTZ
LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_now_kst TIMESTAMPTZ := NOW() AT TIME ZONE 'Asia/Seoul';
  v_days_until INT;
BEGIN
  v_days_until := ((6 - EXTRACT(DOW FROM v_now_kst)::INT) % 7) + 1;
  RETURN date_trunc('day', v_now_kst) + (v_days_until || ' days')::INTERVAL;
END;
$$;

-- 1) create_family_with_kid: epoch = next Sunday 00:00 KST
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
  p_consent_ua TEXT DEFAULT NULL
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
  IF p_starting_capital < 0 THEN
    RAISE EXCEPTION 'starting_capital must be non-negative';
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
    epoch_kst, week_num_started
  ) VALUES (
    v_kid_membership_id, p_starting_capital, p_starting_capital, 0,
    v_epoch_kst, 0
  ) RETURNING id INTO v_account_id;

  INSERT INTO transactions (account_id, transaction_type, zone, amount, week_num)
  VALUES (v_account_id, 'initial_deposit', 'free', p_starting_capital, 0);

  INSERT INTO weekly_snapshots (account_id, cycle_number, week_num, free_balance, experiment_balance, bonus_balance)
  VALUES (v_account_id, 1, 0, p_starting_capital, 0, 0);

  RETURN jsonb_build_object(
    'ok', true,
    'family_id', v_family_id,
    'kid_membership_id', v_kid_membership_id,
    'account_id', v_account_id
  );
END;
$$;

-- 2) choose_cycle_end_action reset: epoch = next Sunday
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
  v_new_epoch := next_sunday_kst();

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

-- 3) Realign existing active accounts: shift epoch from Monday to the preceding Sunday.
-- For accounts whose epoch is already a Sunday, no change.
UPDATE accounts
SET epoch_kst = epoch_kst - INTERVAL '1 day'
WHERE cycle_status = 'active'
  AND EXTRACT(DOW FROM (epoch_kst AT TIME ZONE 'Asia/Seoul')) = 1;  -- 1 = Monday

COMMENT ON FUNCTION next_sunday_kst IS 'Returns the next upcoming Sunday 00:00 KST (always strictly in the future).';
