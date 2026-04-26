-- T2 follow-up migration 016: permanent kid access code on memberships
-- Replaces single-use kid_login_codes flow with a durable code per kid.

ALTER TABLE memberships
  ADD COLUMN access_code TEXT UNIQUE
  CHECK (access_code IS NULL OR length(access_code) = 6);

-- Function to generate a unique 6-char code (excluding confusing chars)
CREATE OR REPLACE FUNCTION generate_unique_access_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 chars, no 0/O/I/1/L
  candidate TEXT;
  exists_count INT;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM memberships WHERE access_code = candidate;
    IF exists_count = 0 THEN
      RETURN candidate;
    END IF;
  END LOOP;
END;
$$;

-- Backfill: assign codes to existing kid memberships
UPDATE memberships
SET access_code = generate_unique_access_code()
WHERE role = 'kid' AND access_code IS NULL;

-- Constraint: kid memberships must have access_code (post-backfill)
ALTER TABLE memberships
  ADD CONSTRAINT kid_must_have_access_code
  CHECK (role <> 'kid' OR access_code IS NOT NULL);

CREATE INDEX memberships_access_code_idx ON memberships(access_code) WHERE access_code IS NOT NULL;

-- RPC: rotate a kid's access code (called by guardian)
CREATE OR REPLACE FUNCTION rotate_kid_access_code(
  p_kid_membership_id UUID,
  p_guardian_user_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_new_code TEXT;
BEGIN
  SELECT family_id INTO v_family_id FROM memberships WHERE id = p_kid_membership_id AND role = 'kid';
  IF v_family_id IS NULL THEN RAISE EXCEPTION 'kid membership not found'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = p_guardian_user_id AND family_id = v_family_id AND role = 'guardian'
  ) THEN
    RAISE EXCEPTION 'guardian not in same family';
  END IF;

  v_new_code := generate_unique_access_code();
  UPDATE memberships SET access_code = v_new_code WHERE id = p_kid_membership_id;
  RETURN v_new_code;
END;
$$;

-- Update create_family_with_kid RPC to also set access_code
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
  v_access_code TEXT;
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

  v_access_code := generate_unique_access_code();
  INSERT INTO memberships (family_id, user_id, role, display_name, age_tier, grade, access_code)
    VALUES (v_family_id, p_kid_user_id, 'kid', p_kid_nickname, v_tier, p_kid_grade, v_access_code)
    RETURNING id INTO v_kid_membership_id;

  v_epoch_kst := date_trunc('week', (NOW() AT TIME ZONE 'Asia/Seoul')) + INTERVAL '7 days';
  v_free_amount := (p_starting_capital * 80) / 100;
  v_exp_amount := p_starting_capital - v_free_amount;

  INSERT INTO accounts (membership_id, starting_capital, free_balance, experiment_balance, epoch_kst, week_num_started)
    VALUES (v_kid_membership_id, p_starting_capital, v_free_amount, v_exp_amount, v_epoch_kst, 0)
    RETURNING id INTO v_account_id;

  INSERT INTO transactions (account_id, transaction_type, zone, amount, week_num) VALUES
    (v_account_id, 'initial_deposit', 'free', v_free_amount, 0),
    (v_account_id, 'initial_deposit', 'experiment', v_exp_amount, 0);

  INSERT INTO weekly_snapshots (account_id, cycle_number, week_num, free_balance, experiment_balance, bonus_balance)
    VALUES (v_account_id, 1, 0, v_free_amount, v_exp_amount, 0);

  RETURN jsonb_build_object(
    'ok', true,
    'family_id', v_family_id,
    'kid_membership_id', v_kid_membership_id,
    'account_id', v_account_id,
    'access_code', v_access_code
  );
END;
$$;
