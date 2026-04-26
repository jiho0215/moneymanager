-- T4 migration 014: process_claim atomic RPC (ADR-007)
-- Validates problem_id replay, attempt counting, applies interest, writes snapshot — all atomic.

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

  -- Count this week's attempts
  SELECT COUNT(*) INTO v_attempt_count
    FROM claim_attempts WHERE account_id = p_account_id AND week_num = p_week_num;
  IF v_attempt_count >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'attempts_exhausted');
  END IF;

  -- Validate answer (trim, strip commas, compare)
  v_is_correct := REPLACE(REPLACE(TRIM(p_user_answer), ',', ''), ' ', '')
                = REPLACE(REPLACE(TRIM(p_expected_answer), ',', ''), ' ', '');

  -- Always log attempt
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

  -- Compute pending interest (per-week floor) for weeks baseline+1..p_week_num
  v_weeks_to_claim := LEAST(p_week_num - v_baseline, v_max_back_weeks);
  v_running := v_account.experiment_balance;
  FOR i IN 1..v_weeks_to_claim LOOP
    v_running := v_running + FLOOR(v_running * v_account.weekly_growth_rate_bp / 10000.0)::BIGINT;
  END LOOP;
  v_pending := v_running - v_account.experiment_balance;

  -- Insert ledger entries: interest_accrued + interest_claimed
  INSERT INTO transactions (account_id, transaction_type, zone, amount, week_num)
  VALUES (p_account_id, 'interest_accrued', 'experiment', v_pending, p_week_num);
  INSERT INTO transactions (account_id, transaction_type, zone, amount, week_num)
  VALUES (p_account_id, 'interest_claimed', 'experiment', 0, p_week_num);

  -- Update cached balance + last_claimed
  UPDATE accounts SET
    experiment_balance = experiment_balance + v_pending,
    last_claimed_week_num = p_week_num,
    pending_interest = 0,
    updated_at = NOW()
  WHERE id = p_account_id;

  -- Snapshot current week (upsert)
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
    'new_experiment_balance', v_account.experiment_balance + v_pending,
    'growth_this_week', v_pending,
    'weeks_claimed', v_weeks_to_claim
  );
END;
$$;

CREATE OR REPLACE FUNCTION transfer_free_to_experiment(
  p_account_id UUID,
  p_amount BIGINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
BEGIN
  SELECT * INTO v_account FROM accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not found'; END IF;
  IF v_account.cycle_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cycle_ended');
  END IF;
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;
  IF p_amount > v_account.free_balance THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'insufficient_balance');
  END IF;

  INSERT INTO transactions (account_id, transaction_type, zone, amount)
  VALUES
    (p_account_id, 'free_to_experiment', 'free', -p_amount),
    (p_account_id, 'free_to_experiment', 'experiment', p_amount);

  UPDATE accounts SET
    free_balance = free_balance - p_amount,
    experiment_balance = experiment_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_account_id;

  RETURN jsonb_build_object(
    'ok', true,
    'new_free_balance', v_account.free_balance - p_amount,
    'new_experiment_balance', v_account.experiment_balance + p_amount
  );
END;
$$;
