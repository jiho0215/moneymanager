-- T2 migration 013: atomic create_family_with_kid RPC
-- Inserts: family + consent + guardian membership + kid membership + account + initial_deposit transactions

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
  v_free_amount BIGINT;
  v_exp_amount BIGINT;
  v_tier age_tier;
BEGIN
  IF p_starting_capital < 0 THEN
    RAISE EXCEPTION 'starting_capital must be non-negative';
  END IF;
  IF p_kid_grade BETWEEN 1 AND 6 THEN v_tier := 'elementary';
  ELSIF p_kid_grade BETWEEN 7 AND 9 THEN v_tier := 'middle';
  ELSIF p_kid_grade BETWEEN 10 AND 12 THEN v_tier := 'high';
  ELSE RAISE EXCEPTION 'kid_grade must be 1-12'; END IF;

  -- 1. family
  INSERT INTO families (name) VALUES (p_family_name) RETURNING id INTO v_family_id;

  -- 2. consent (PIPA Article 22 evidence)
  INSERT INTO consents (family_id, accepted_by_user_id, consent_text, consent_version, ip_address, user_agent)
  VALUES (v_family_id, p_guardian_user_id, p_consent_text, p_consent_version, p_consent_ip, p_consent_ua);

  -- 3. guardian membership
  INSERT INTO memberships (family_id, user_id, role, display_name)
  VALUES (v_family_id, p_guardian_user_id, 'guardian', p_guardian_display_name);

  -- 4. kid membership
  INSERT INTO memberships (family_id, user_id, role, display_name, age_tier, grade)
  VALUES (v_family_id, p_kid_user_id, 'kid', p_kid_nickname, v_tier, p_kid_grade)
  RETURNING id INTO v_kid_membership_id;

  -- 5. account: epoch = next Monday 00:00 KST
  v_epoch_kst := date_trunc('week', (NOW() AT TIME ZONE 'Asia/Seoul')) + INTERVAL '7 days';
  v_free_amount := (p_starting_capital * 80) / 100;
  v_exp_amount := p_starting_capital - v_free_amount;

  INSERT INTO accounts (
    membership_id, starting_capital, free_balance, experiment_balance,
    epoch_kst, week_num_started
  ) VALUES (
    v_kid_membership_id, p_starting_capital, v_free_amount, v_exp_amount,
    v_epoch_kst, 0
  ) RETURNING id INTO v_account_id;

  -- 6. initial_deposit transactions (free + experiment)
  INSERT INTO transactions (account_id, transaction_type, zone, amount, week_num)
  VALUES
    (v_account_id, 'initial_deposit', 'free', v_free_amount, 0),
    (v_account_id, 'initial_deposit', 'experiment', v_exp_amount, 0);

  -- 7. week 0 snapshot
  INSERT INTO weekly_snapshots (account_id, cycle_number, week_num, free_balance, experiment_balance, bonus_balance)
  VALUES (v_account_id, 1, 0, v_free_amount, v_exp_amount, 0);

  RETURN jsonb_build_object(
    'ok', true,
    'family_id', v_family_id,
    'kid_membership_id', v_kid_membership_id,
    'account_id', v_account_id
  );
END;
$$;

COMMENT ON FUNCTION create_family_with_kid IS 'T2: atomic family + consent + memberships + account + initial transactions';
