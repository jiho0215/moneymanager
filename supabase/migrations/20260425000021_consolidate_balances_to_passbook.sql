-- Migration 021: Consolidate existing account balances to 통장 (passbook) semantics.
-- Old model: free=80% + experiment=20% split, plus legacy free_to_experiment transfers.
-- New model: free=원금 (all deposits), experiment=이자 (all interest), bonus=legacy 0.
-- Schema unchanged; this is a data + function-logic migration only.

-- 1) Type-based reconcile: drift detected when cache disagrees with the deposit/interest
--    sums (rather than zone tags, which are stale under the passbook model).
CREATE OR REPLACE FUNCTION reconcile_balance(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE
AS $$
DECLARE
  v_free_cached BIGINT;
  v_exp_cached BIGINT;
  v_bonus_cached BIGINT;
  v_principal_computed BIGINT;
  v_interest_computed BIGINT;
BEGIN
  SELECT free_balance, experiment_balance, bonus_balance
    INTO v_free_cached, v_exp_cached, v_bonus_cached
    FROM accounts WHERE id = p_account_id;

  IF v_free_cached IS NULL THEN
    RAISE EXCEPTION 'account not found: %', p_account_id;
  END IF;

  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE transaction_type IN ('initial_deposit', 'manual_adjustment', 'bonus_match')
    ), 0),
    COALESCE(SUM(amount) FILTER (
      WHERE transaction_type = 'interest_accrued'
    ), 0)
  INTO v_principal_computed, v_interest_computed
  FROM transactions WHERE account_id = p_account_id;

  RETURN jsonb_build_object(
    'drift', (
      v_free_cached <> v_principal_computed
      OR v_exp_cached <> v_interest_computed
      OR v_bonus_cached <> 0
    ),
    'principal', jsonb_build_object('cached', v_free_cached, 'computed', v_principal_computed),
    'interest',  jsonb_build_object('cached', v_exp_cached, 'computed', v_interest_computed),
    'bonus',     jsonb_build_object('cached', v_bonus_cached, 'expected', 0)
  );
END;
$$;

-- 2) Type-based recompute: rebuild cached balances from the ledger using
--    transaction TYPES (not zones).
CREATE OR REPLACE FUNCTION recompute_balance(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  v_principal BIGINT;
  v_interest BIGINT;
BEGIN
  SELECT
    COALESCE(SUM(amount) FILTER (
      WHERE transaction_type IN ('initial_deposit', 'manual_adjustment', 'bonus_match')
    ), 0),
    COALESCE(SUM(amount) FILTER (
      WHERE transaction_type = 'interest_accrued'
    ), 0)
  INTO v_principal, v_interest
  FROM transactions WHERE account_id = p_account_id;

  UPDATE accounts SET
    free_balance = v_principal,
    experiment_balance = v_interest,
    bonus_balance = 0,
    updated_at = NOW()
  WHERE id = p_account_id;

  RETURN jsonb_build_object('ok', true, 'principal', v_principal, 'interest', v_interest);
END;
$$;

-- 3) Recompute all active accounts.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM accounts WHERE cycle_status = 'active' LOOP
    PERFORM recompute_balance(r.id);
  END LOOP;
END;
$$;

-- 4) Realign existing week-0 snapshots to the new semantics.
--    Week 0 represents the state immediately after initial_deposit, so:
--    free = starting_capital (entire 원금), experiment = 0, bonus = 0.
UPDATE weekly_snapshots ws SET
  free_balance = a.starting_capital,
  experiment_balance = 0,
  bonus_balance = 0
FROM accounts a
WHERE ws.account_id = a.id
  AND ws.week_num = 0
  AND ws.cycle_number = a.cycle_number;

COMMENT ON FUNCTION reconcile_balance IS '통장 모델: principal vs interest by transaction type (not zone)';
COMMENT ON FUNCTION recompute_balance IS '통장 모델: rebuild cached free=원금/exp=이자 from ledger types';
