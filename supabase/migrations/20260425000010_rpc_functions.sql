-- T1-foundation migration 010: RPC functions
-- ADR-006 (KST week computation) + ADR-007 (atomic claim-time write)

-- ===== compute_week_num =====
CREATE OR REPLACE FUNCTION compute_week_num(p_account_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_epoch TIMESTAMPTZ;
  v_now_kst TIMESTAMPTZ;
  v_seconds NUMERIC;
BEGIN
  SELECT epoch_kst INTO v_epoch FROM accounts WHERE id = p_account_id;
  IF v_epoch IS NULL THEN
    RAISE EXCEPTION 'account not found: %', p_account_id;
  END IF;
  v_now_kst := NOW() AT TIME ZONE 'Asia/Seoul';
  v_seconds := EXTRACT(EPOCH FROM (v_now_kst - v_epoch));
  RETURN GREATEST(0, FLOOR(v_seconds / (7 * 86400))::INTEGER);
END;
$$;

-- ===== reconcile_balance =====
-- Compares cached balance vs SUM(transactions). Returns drift report.
CREATE OR REPLACE FUNCTION reconcile_balance(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_free_cached BIGINT; v_exp_cached BIGINT; v_bonus_cached BIGINT;
  v_free_computed BIGINT; v_exp_computed BIGINT; v_bonus_computed BIGINT;
BEGIN
  SELECT free_balance, experiment_balance, bonus_balance
    INTO v_free_cached, v_exp_cached, v_bonus_cached
    FROM accounts WHERE id = p_account_id;

  IF v_free_cached IS NULL THEN
    RAISE EXCEPTION 'account not found: %', p_account_id;
  END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (WHERE zone = 'free'), 0),
    COALESCE(SUM(amount) FILTER (WHERE zone = 'experiment'), 0),
    COALESCE(SUM(amount) FILTER (WHERE zone = 'bonus'), 0)
  INTO v_free_computed, v_exp_computed, v_bonus_computed
  FROM transactions WHERE account_id = p_account_id;

  RETURN jsonb_build_object(
    'drift', (v_free_cached <> v_free_computed OR v_exp_cached <> v_exp_computed OR v_bonus_cached <> v_bonus_computed),
    'free', jsonb_build_object('cached', v_free_cached, 'computed', v_free_computed),
    'experiment', jsonb_build_object('cached', v_exp_cached, 'computed', v_exp_computed),
    'bonus', jsonb_build_object('cached', v_bonus_cached, 'computed', v_bonus_computed)
  );
END;
$$;

-- ===== recompute_balance =====
-- Recovers cached balance from ledger (ADR-007 "Trust the Ledger")
CREATE OR REPLACE FUNCTION recompute_balance(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_free BIGINT; v_exp BIGINT; v_bonus BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(amount) FILTER (WHERE zone = 'free'), 0),
    COALESCE(SUM(amount) FILTER (WHERE zone = 'experiment'), 0),
    COALESCE(SUM(amount) FILTER (WHERE zone = 'bonus'), 0)
  INTO v_free, v_exp, v_bonus
  FROM transactions WHERE account_id = p_account_id;

  UPDATE accounts SET
    free_balance = v_free,
    experiment_balance = v_exp,
    bonus_balance = v_bonus,
    updated_at = NOW()
  WHERE id = p_account_id;

  RETURN jsonb_build_object('ok', true, 'free', v_free, 'experiment', v_exp, 'bonus', v_bonus);
END;
$$;

-- Note: process_claim and create_family_with_kid RPCs are owned by T2/T4/T5 since they
-- depend on domain logic (math validation, claim semantics) that lives in those tickets.
-- T1 ships only the read-side RPCs (compute_week_num, reconcile_balance, recompute_balance).
-- T2 will add: create_family_with_kid (atomic family + memberships + accounts + consent)
-- T4 will add: process_claim (atomic claim_attempts + transactions + accounts + snapshots)
-- T5 will add: process_deposit (additional parent deposits with bonus matching)

COMMENT ON FUNCTION compute_week_num IS 'ADR-006: floor((now_kst - epoch_kst) / 7d)';
COMMENT ON FUNCTION reconcile_balance IS 'ADR-007: detect cache vs ledger drift';
COMMENT ON FUNCTION recompute_balance IS 'ADR-007: trust-the-ledger recovery';
