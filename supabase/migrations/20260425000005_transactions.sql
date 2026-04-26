-- T1-foundation migration 005: transactions (append-only ledger; ADR-005)

CREATE TYPE transaction_type AS ENUM (
  'initial_deposit',
  'free_withdraw',
  'free_to_experiment',
  'experiment_to_free',
  'interest_accrued',
  'interest_claimed',
  'bonus_match',
  'bonus_match_revert',
  'manual_adjustment'
);

CREATE TYPE zone_type AS ENUM ('free', 'experiment', 'bonus');

CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  transaction_type transaction_type NOT NULL,
  zone zone_type NOT NULL,
  amount BIGINT NOT NULL,
  week_num INTEGER NULL,
  reverses_transaction_id UUID NULL REFERENCES transactions(id),
  metadata JSONB NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX transactions_account_created_idx ON transactions(account_id, created_at DESC);
CREATE INDEX transactions_account_zone_idx ON transactions(account_id, zone);
CREATE INDEX transactions_account_week_idx ON transactions(account_id, week_num) WHERE week_num IS NOT NULL;

COMMENT ON TABLE transactions IS 'Append-only ledger (ADR-005). UPDATE/DELETE blocked by trigger in migration 009.';
