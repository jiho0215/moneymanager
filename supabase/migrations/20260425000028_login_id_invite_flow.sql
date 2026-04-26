-- Migration 028: kid login model = globally-unique login_id + kid-chosen password
-- via parent-issued invite tokens. Drops the old global nickname uniqueness so
-- 'display_name' is just for display and the new 'login_id' is what's globally
-- unique. Parent can add multiple kids to one family; each kid claims their
-- own login info via a one-time /join/{token} link.
--
-- Existing test data is wiped per user request (no production users yet).

-- 1) Wipe test data. TRUNCATE … CASCADE bypasses row-level triggers on
--    append-only tables (consents) which DELETE could not.
TRUNCATE TABLE families RESTART IDENTITY CASCADE;

-- 2) Drop kids' auth users so internal emails free up.
DELETE FROM auth.users
WHERE (raw_user_meta_data->>'role') = 'kid';

-- 3) Drop the legacy global-nickname unique index (migration 017).
DROP INDEX IF EXISTS kid_nickname_unique;

-- 4) New columns on memberships.
ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS login_id TEXT,
  ADD COLUMN IF NOT EXISTS invite_token TEXT;

-- 5) New uniqueness: only kids have login_id, must be globally unique.
CREATE UNIQUE INDEX IF NOT EXISTS kid_login_id_unique
  ON memberships (login_id)
  WHERE role = 'kid' AND login_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS membership_invite_token_unique
  ON memberships (invite_token)
  WHERE invite_token IS NOT NULL;

-- 6) Helper: random 16-char invite token (URL-safe).
CREATE OR REPLACE FUNCTION generate_invite_token() RETURNS TEXT
LANGUAGE plpgsql AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  candidate TEXT;
  exists_count INT;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..16 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::INT, 1);
    END LOOP;
    SELECT count(*) INTO exists_count FROM memberships WHERE invite_token = candidate;
    IF exists_count = 0 THEN RETURN candidate; END IF;
  END LOOP;
END;
$$;

-- 7) Update create_family_with_kid: kid is created WITHOUT auth user.
--    The parent gets back an invite_token; the kid claims it via /join.
CREATE OR REPLACE FUNCTION create_family_with_kid(
  p_family_name TEXT,
  p_guardian_user_id UUID,
  p_guardian_display_name TEXT,
  p_kid_user_id UUID,           -- legacy param, ignored; kept for signature compat
  p_kid_nickname TEXT,
  p_kid_grade SMALLINT,
  p_starting_capital BIGINT,
  p_consent_text TEXT,
  p_consent_version TEXT,
  p_consent_ip TEXT DEFAULT NULL,
  p_consent_ua TEXT DEFAULT NULL,
  p_setup_state TEXT DEFAULT 'parent_setup_pending',
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
  v_invite_token TEXT;
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

  PERFORM NOW() AT TIME ZONE p_timezone;

  INSERT INTO families (name, timezone) VALUES (p_family_name, p_timezone) RETURNING id INTO v_family_id;
  INSERT INTO consents (family_id, accepted_by_user_id, consent_text, consent_version, ip_address, user_agent)
    VALUES (v_family_id, p_guardian_user_id, p_consent_text, p_consent_version, p_consent_ip, p_consent_ua);
  INSERT INTO memberships (family_id, user_id, role, display_name)
    VALUES (v_family_id, p_guardian_user_id, 'guardian', p_guardian_display_name);

  v_invite_token := generate_invite_token();

  -- Kid membership has NO user_id yet — kid will claim via /join/{token}.
  INSERT INTO memberships (family_id, user_id, role, display_name, age_tier, grade, invite_token)
    VALUES (v_family_id, NULL, 'kid', p_kid_nickname, v_tier, p_kid_grade, v_invite_token)
    RETURNING id INTO v_kid_membership_id;

  INSERT INTO accounts (
    membership_id, starting_capital, free_balance, experiment_balance,
    epoch_kst, week_num_started, setup_state
  ) VALUES (
    v_kid_membership_id, p_starting_capital, p_starting_capital, 0,
    today_midnight_in_tz(p_timezone), 0, p_setup_state
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
    'account_id', v_account_id,
    'invite_token', v_invite_token
  );
END;
$$;

-- 8) Add another kid to an existing family (multi-kid).
CREATE OR REPLACE FUNCTION add_kid_to_family(
  p_family_id UUID,
  p_actor_user_id UUID,
  p_kid_nickname TEXT,
  p_kid_grade SMALLINT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kid_membership_id UUID;
  v_account_id UUID;
  v_invite_token TEXT;
  v_tier age_tier;
  v_family RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = p_actor_user_id AND family_id = p_family_id AND role = 'guardian'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_guardian');
  END IF;

  IF p_kid_grade BETWEEN 1 AND 6 THEN v_tier := 'elementary';
  ELSIF p_kid_grade BETWEEN 7 AND 9 THEN v_tier := 'middle';
  ELSIF p_kid_grade BETWEEN 10 AND 12 THEN v_tier := 'high';
  ELSE RETURN jsonb_build_object('ok', false, 'reason', 'invalid_grade'); END IF;

  SELECT timezone INTO v_family FROM families WHERE id = p_family_id;

  v_invite_token := generate_invite_token();

  INSERT INTO memberships (family_id, user_id, role, display_name, age_tier, grade, invite_token)
    VALUES (p_family_id, NULL, 'kid', p_kid_nickname, v_tier, p_kid_grade, v_invite_token)
    RETURNING id INTO v_kid_membership_id;

  INSERT INTO accounts (
    membership_id, starting_capital, free_balance, experiment_balance,
    epoch_kst, week_num_started, setup_state
  ) VALUES (
    v_kid_membership_id, 0, 0, 0,
    today_midnight_in_tz(v_family.timezone), 0, 'parent_setup_pending'
  ) RETURNING id INTO v_account_id;

  RETURN jsonb_build_object(
    'ok', true,
    'kid_membership_id', v_kid_membership_id,
    'account_id', v_account_id,
    'invite_token', v_invite_token
  );
END;
$$;

-- 9) Kid claims login info via invite token.
--    Creates the auth user (caller-provided p_kid_user_id) and writes login_id + clears token.
CREATE OR REPLACE FUNCTION claim_kid_login(
  p_invite_token TEXT,
  p_kid_user_id UUID,
  p_login_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership RECORD;
  v_existing INT;
BEGIN
  SELECT * INTO v_membership FROM memberships
    WHERE invite_token = p_invite_token AND role = 'kid';
  IF v_membership IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_token');
  END IF;
  IF v_membership.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_claimed');
  END IF;

  IF length(p_login_id) < 1 OR length(p_login_id) > 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_login_id');
  END IF;

  SELECT count(*) INTO v_existing FROM memberships
    WHERE role = 'kid' AND login_id = p_login_id;
  IF v_existing > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'login_id_taken');
  END IF;

  UPDATE memberships SET
    user_id = p_kid_user_id,
    login_id = p_login_id,
    invite_token = NULL
  WHERE id = v_membership.id;

  RETURN jsonb_build_object(
    'ok', true,
    'kid_membership_id', v_membership.id,
    'family_id', v_membership.family_id
  );
END;
$$;

-- 10) Parent resets a kid's login_id (auth password reset is done via admin API in app code).
CREATE OR REPLACE FUNCTION reset_kid_login_id(
  p_kid_membership_id UUID,
  p_actor_user_id UUID,
  p_new_login_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_family_id UUID;
  v_existing INT;
BEGIN
  SELECT family_id INTO v_family_id FROM memberships
    WHERE id = p_kid_membership_id AND role = 'kid';
  IF v_family_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'kid_not_found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = p_actor_user_id AND family_id = v_family_id AND role = 'guardian'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_guardian');
  END IF;

  IF length(p_new_login_id) < 1 OR length(p_new_login_id) > 20 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_login_id');
  END IF;

  SELECT count(*) INTO v_existing FROM memberships
    WHERE role = 'kid' AND login_id = p_new_login_id AND id <> p_kid_membership_id;
  IF v_existing > 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'login_id_taken');
  END IF;

  UPDATE memberships SET login_id = p_new_login_id WHERE id = p_kid_membership_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

COMMENT ON COLUMN memberships.login_id IS 'Globally unique login alias kids choose at /join. Display name (display_name) is separate.';
COMMENT ON COLUMN memberships.invite_token IS 'One-time token issued to parent for kid claim flow at /join/{token}. NULL once claimed.';
