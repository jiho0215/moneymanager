-- T5 migration 015: process_deposit (parent additional deposits + bonus match)
-- + cycle end action

CREATE OR REPLACE FUNCTION process_deposit(
  p_account_id UUID,
  p_amount BIGINT,
  p_zone TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account RECORD;
  v_bonus BIGINT := 0;
BEGIN
  IF p_zone NOT IN ('free', 'experiment') THEN
    RAISE EXCEPTION 'invalid zone: %', p_zone;
  END IF;
  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_amount');
  END IF;

  SELECT * INTO v_account FROM accounts WHERE id = p_account_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'account not found'; END IF;
  IF v_account.cycle_status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cycle_ended');
  END IF;

  IF p_zone = 'free' THEN
    INSERT INTO transactions (account_id, transaction_type, zone, amount)
    VALUES (p_account_id, 'manual_adjustment', 'free', p_amount);
    UPDATE accounts SET free_balance = free_balance + p_amount, updated_at = NOW() WHERE id = p_account_id;
  ELSE
    INSERT INTO transactions (account_id, transaction_type, zone, amount)
    VALUES (p_account_id, 'manual_adjustment', 'experiment', p_amount);
    UPDATE accounts SET experiment_balance = experiment_balance + p_amount, updated_at = NOW() WHERE id = p_account_id;

    IF v_account.bonus_match_rate_bp > 0 THEN
      v_bonus := FLOOR(p_amount * v_account.bonus_match_rate_bp / 10000.0)::BIGINT;
      IF v_bonus > 0 THEN
        INSERT INTO transactions (account_id, transaction_type, zone, amount)
        VALUES (p_account_id, 'bonus_match', 'bonus', v_bonus);
        UPDATE accounts SET bonus_balance = bonus_balance + v_bonus, updated_at = NOW() WHERE id = p_account_id;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'bonus_amount', v_bonus);
END;
$$;

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
  v_free BIGINT;
  v_exp BIGINT;
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
    -- no-op; cycle continues past 8 weeks
    RETURN jsonb_build_object('ok', true, 'cycle_status', 'active', 'extended', true);
  END IF;

  -- reset
  IF p_new_starting_capital IS NULL OR p_new_starting_capital <= 0 THEN
    RAISE EXCEPTION 'reset requires new_starting_capital > 0';
  END IF;
  v_free := (p_new_starting_capital * 80) / 100;
  v_exp := p_new_starting_capital - v_free;
  v_new_epoch := date_trunc('week', (NOW() AT TIME ZONE 'Asia/Seoul')) + INTERVAL '7 days';

  INSERT INTO transactions (account_id, transaction_type, zone, amount)
  VALUES
    (p_account_id, 'initial_deposit', 'free', v_free),
    (p_account_id, 'initial_deposit', 'experiment', v_exp);

  UPDATE accounts SET
    cycle_number = cycle_number + 1,
    cycle_status = 'active',
    starting_capital = p_new_starting_capital,
    free_balance = v_free,
    experiment_balance = v_exp,
    bonus_balance = 0,
    pending_interest = 0,
    epoch_kst = v_new_epoch,
    week_num_started = 0,
    last_claimed_week_num = NULL,
    updated_at = NOW()
  WHERE id = p_account_id;

  INSERT INTO weekly_snapshots (account_id, cycle_number, week_num, free_balance, experiment_balance, bonus_balance)
  VALUES (p_account_id, v_account.cycle_number + 1, 0, v_free, v_exp, 0)
  ON CONFLICT (account_id, cycle_number, week_num) DO UPDATE SET
    free_balance = EXCLUDED.free_balance,
    experiment_balance = EXCLUDED.experiment_balance,
    bonus_balance = EXCLUDED.bonus_balance;

  RETURN jsonb_build_object('ok', true, 'cycle_status', 'active', 'cycle_number', v_account.cycle_number + 1);
END;
$$;

CREATE OR REPLACE FUNCTION generate_kid_login_code(
  p_kid_membership_id UUID,
  p_guardian_user_id UUID,
  p_code TEXT,
  p_expires_at TIMESTAMPTZ
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
BEGIN
  SELECT family_id INTO v_family_id FROM memberships WHERE id = p_kid_membership_id AND role = 'kid';
  IF v_family_id IS NULL THEN RAISE EXCEPTION 'kid membership not found'; END IF;

  -- Verify guardian belongs to same family
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = p_guardian_user_id AND family_id = v_family_id AND role = 'guardian'
  ) THEN
    RAISE EXCEPTION 'guardian not in same family';
  END IF;

  INSERT INTO kid_login_codes (code, kid_membership_id, family_id, created_by_user_id, expires_at)
  VALUES (p_code, p_kid_membership_id, v_family_id, p_guardian_user_id, p_expires_at);

  RETURN jsonb_build_object('ok', true, 'code', p_code, 'expires_at', p_expires_at);
END;
$$;
