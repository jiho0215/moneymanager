DROP FUNCTION IF EXISTS current_user_family_id();
DROP POLICY IF EXISTS families_select ON families;
DROP POLICY IF EXISTS memberships_select ON memberships;
DROP POLICY IF EXISTS consents_select ON consents;
DROP POLICY IF EXISTS accounts_select ON accounts;
DROP POLICY IF EXISTS transactions_select ON transactions;
DROP POLICY IF EXISTS claim_attempts_select ON claim_attempts;
DROP POLICY IF EXISTS weekly_snapshots_select ON weekly_snapshots;

ALTER TABLE families DISABLE ROW LEVEL SECURITY;
ALTER TABLE memberships DISABLE ROW LEVEL SECURITY;
ALTER TABLE consents DISABLE ROW LEVEL SECURITY;
ALTER TABLE accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE claim_attempts DISABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_snapshots DISABLE ROW LEVEL SECURITY;
