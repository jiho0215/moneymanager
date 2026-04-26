-- Migration 019: 해당 주에만 청구 가능 (no back-claim)
-- 청구는 이번 주 한 번 / 1주 분 이자만. 놓친 주는 영영 사라짐.
-- expired_pending 체크 제거, max_back_weeks 로직 제거.

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
  v_pending BIGINT := 0;
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

  -- 이번 주 한 번만: 현재 통장 합계의 weekly_growth_rate_bp%를 1주 분만 적립
  v_total_balance := v_account.free_balance + v_account.experiment_balance + v_account.bonus_balance;
  v_pending := FLOOR(v_total_balance * v_account.weekly_growth_rate_bp / 10000.0)::BIGINT;

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
    'weeks_claimed', 1
  );
END;
$$;

COMMENT ON FUNCTION process_claim IS '해당 주에만 청구 가능. 1주 놓치면 그 주 이자는 영영 사라짐. 1주 분만 적립.';
