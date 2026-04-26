-- Migration 018: Single-passbook (통장 하나) model
-- Conceptually collapses three zones into "원금(저금) + 이자". Schema unchanged:
--   free_balance       -> principal (사용자 입금)
--   experiment_balance -> interest (복리로 쌓인 부분)
--   bonus_balance      -> legacy, frozen at 0 going forward
-- Existing balances continue to be summed into the kid's visible total.

-- 1) process_claim: interest is computed on the FULL sum (free+exp+bonus),
--    credited to experiment_balance (the "이자" pool).
CREATE OR REPLACE FUNCTION process_claim(
  p_account_id UUID,
  p_week_num INTEGER,
  p_problem_id TEXT,
  p_user_answer TEXT,
  p_expected_answer TEXT,
  p_problem_data JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
  v_attempt_count INTEGER;
  v_is_correct BOOLEAN;
  v_baseline INTEGER;
  v_pending BIGINT := 0;
  v_running BIGINT;
  v_weeks_to_claim INTEGER;
  v_max_back_weeks CONSTANT INTEGER := 4;
  v_total_balance BIGINT;
BEGIN
  SELECT * INTO v_account FROM accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not found'; END IF;

  IF v_account.cycle_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cycle_ended');
  END IF;
  IF p_week_num < v_account.week_num_started + 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_yet_unlockable');
  END IF;
  IF v_account.last_claimed_week_num IS NOT NULL AND v_account.last_claimed_week_num >= p_week_num THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  v_baseline := COALESCE(v_account.last_claimed_week_num, v_account.week_num_started);
  IF p_week_num - v_baseline > v_max_back_weeks + 1 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired_pending');
  END IF;

  SELECT COUNT(*) INTO v_attempt_count
    FROM claim_attempts WHERE account_id = p_account_id AND week_num = p_week_num;
  IF v_attempt_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'attempts_exhausted');
  END IF;

  v_is_correct := REPLACE(REPLACE(TRIM(p_user_answer), ',', ''), ' ', '')
                = REPLACE(REPLACE(TRIM(p_expected_answer), ',', ''), ' ', '');

  INSERT INTO claim_attempts (
    account_id, week_num, problem_id, problem_data, user_answer,
    is_correct, attempt_number_this_week, is_locked_out
  ) VALUES (
    p_account_id, p_week_num, p_problem_id, p_problem_data, p_user_answer,
    v_is_correct, v_attempt_count + 1, (v_attempt_count + 1) >= 5 AND NOT v_is_correct
  );

  IF NOT v_is_correct THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'wrong_answer',
      'attempts_remaining', GREATEST(0, 5 - (v_attempt_count + 1)));
  END IF;

  -- Compound on the FULL passbook total
  v_weeks_to_claim := LEAST(p_week_num - v_baseline, v_max_back_weeks);
  v_total_balance := v_account.free_balance + v_account.experiment_balance + v_account.bonus_balance;
  v_running := v_total_balance;
  FOR i IN 1..v_weeks_to_claim LOOP
    v_running := v_running + FLOOR(v_running * v_account.weekly_growth_rate_bp / 10000.0)::BIGINT;
  END LOOP;
  v_pending := v_running - v_total_balance;

  INSERT INTO transactions (account_id, transaction_type, zone, amount, week_num)
  VALUES (p_account_id, 'interest_accrued', 'experiment', v_pending, p_week_num);
  INSERT INTO transactions (account_id, transaction_type, zone, amount, week_num)
  VALUES (p_account_id, 'interest_claimed', 'experiment', 0, p_week_num);

  UPDATE accounts SET
    experiment_balance = experiment_balance + v_pending,
    last_claimed_week_num = p_week_num,
    pending_interest = 0,
    updated_at = NOW()
  WHERE id = p_account_id;

  INSERT INTO weekly_snapshots (
    account_id, cycle_number, week_num, free_balance, experiment_balance, bonus_balance, was_claimed_this_week
  ) VALUES (
    p_account_id, v_account.cycle_number, p_week_num,
    v_account.free_balance, v_account.experiment_balance + v_pending, v_account.bonus_balance, true
  )
  ON CONFLICT (account_id, cycle_number, week_num) DO UPDATE SET
    free_balance = EXCLUDED.free_balance,
    experiment_balance = EXCLUDED.experiment_balance,
    bonus_balance = EXCLUDED.bonus_balance,
    was_claimed_this_week = true;

  RETURN jsonb_build_object(
    'ok', true,
    'new_total_balance', v_total_balance + v_pending,
    'growth_this_week', v_pending,
    'weeks_claimed', v_weeks_to_claim
  );
END;
$$;

-- 2) process_deposit: always to free_balance (원금), no zone, no matching
CREATE OR REPLACE FUNCTION process_deposit(
  p_account_id UUID,
  p_amount BIGINT,
  p_zone TEXT DEFAULT NULL  -- ignored, kept for backwards compat
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
BEGIN
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  SELECT * INTO v_account FROM accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not found'; END IF;
  IF v_account.cycle_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cycle_ended');
  END IF;

  INSERT INTO transactions (account_id, transaction_type, zone, amount)
  VALUES (p_account_id, 'manual_adjustment', 'free', p_amount);

  UPDATE accounts SET
    free_balance = free_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_account_id;

  RETURN jsonb_build_object('ok', true, 'bonus_amount', 0);
END;
$$;

-- 3) create_family_with_kid: 100% of starting_capital goes into free_balance (원금)
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

  v_epoch_kst := date_trunc('week', (NOW() AT TIME ZONE 'Asia/Seoul')) + INTERVAL '7 days';

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

-- 4) choose_cycle_end_action reset: 100% of new starting capital goes to free
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
  v_new_epoch := date_trunc('week', (NOW() AT TIME ZONE 'Asia/Seoul')) + INTERVAL '7 days';

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

COMMENT ON FUNCTION process_claim IS '통장 모델: 이자는 (원금+이자+legacy bonus) 합계의 weekly_growth_rate_bp%로 계산되어 experiment_balance(이자 풀)에 적립';
COMMENT ON FUNCTION process_deposit IS '통장 모델: 보호자 입금은 항상 free_balance(원금)에 들어감. zone 파라미터는 무시됨 (backward compat).';
