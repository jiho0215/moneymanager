-- T1-foundation migration 008: RLS policies (ADR-004 — RLS as primary permission)
-- JOIN path: auth.uid() → memberships → family_id → accounts → transactions etc.

ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_snapshots ENABLE ROW LEVEL SECURITY;

-- Helper: return the family_id of the calling auth user (single membership assumed for MVP)
CREATE OR REPLACE FUNCTION current_user_family_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT family_id FROM memberships WHERE user_id = auth.uid() LIMIT 1;
$$;

-- families: only own family is visible
CREATE POLICY families_select ON families FOR SELECT USING (
  id = current_user_family_id()
);

-- memberships: same family
CREATE POLICY memberships_select ON memberships FOR SELECT USING (
  family_id = current_user_family_id()
);

-- consents: same family (guardian and kid both can see for transparency); INSERT only via RPC
CREATE POLICY consents_select ON consents FOR SELECT USING (
  family_id = current_user_family_id()
);

-- accounts: same family
CREATE POLICY accounts_select ON accounts FOR SELECT USING (
  membership_id IN (
    SELECT id FROM memberships WHERE family_id = current_user_family_id()
  )
);

-- transactions: same family (read), inserts go through process_claim/process_deposit RPCs
CREATE POLICY transactions_select ON transactions FOR SELECT USING (
  account_id IN (
    SELECT a.id FROM accounts a
    JOIN memberships m ON a.membership_id = m.id
    WHERE m.family_id = current_user_family_id()
  )
);

-- claim_attempts: same family
CREATE POLICY claim_attempts_select ON claim_attempts FOR SELECT USING (
  account_id IN (
    SELECT a.id FROM accounts a
    JOIN memberships m ON a.membership_id = m.id
    WHERE m.family_id = current_user_family_id()
  )
);

-- weekly_snapshots: same family
CREATE POLICY weekly_snapshots_select ON weekly_snapshots FOR SELECT USING (
  account_id IN (
    SELECT a.id FROM accounts a
    JOIN memberships m ON a.membership_id = m.id
    WHERE m.family_id = current_user_family_id()
  )
);

COMMENT ON FUNCTION current_user_family_id() IS 'SECURITY DEFINER helper for RLS JOIN path (ADR-004)';
