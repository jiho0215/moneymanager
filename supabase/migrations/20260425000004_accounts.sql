-- T1-foundation migration 004: accounts (one per kid; ADR-002 BIGINT KRW + ADR-006 epoch_kst)

CREATE TYPE cycle_status AS ENUM ('active', 'graduated', 'reset');

CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL UNIQUE REFERENCES memberships(id) ON DELETE CASCADE,

  starting_capital BIGINT NOT NULL CHECK (starting_capital >= 0),
  free_balance BIGINT NOT NULL DEFAULT 0 CHECK (free_balance >= 0),
  experiment_balance BIGINT NOT NULL DEFAULT 0 CHECK (experiment_balance >= 0),
  bonus_balance BIGINT NOT NULL DEFAULT 0 CHECK (bonus_balance >= 0),
  pending_interest BIGINT NOT NULL DEFAULT 0 CHECK (pending_interest >= 0),

  weekly_growth_rate_bp INTEGER NOT NULL DEFAULT 1000 CHECK (weekly_growth_rate_bp BETWEEN 0 AND 10000),
  bonus_match_rate_bp INTEGER NOT NULL DEFAULT 2000 CHECK (bonus_match_rate_bp BETWEEN 0 AND 10000),
  weekly_deadline_dow SMALLINT NOT NULL DEFAULT 0 CHECK (weekly_deadline_dow BETWEEN 0 AND 6),

  cycle_number INTEGER NOT NULL DEFAULT 1 CHECK (cycle_number >= 1),
  cycle_status cycle_status NOT NULL DEFAULT 'active',
  epoch_kst TIMESTAMPTZ NOT NULL,
  week_num_started INTEGER NOT NULL DEFAULT 0 CHECK (week_num_started >= 0),
  last_claimed_week_num INTEGER NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX accounts_membership_idx ON accounts(membership_id);
CREATE INDEX accounts_cycle_status_idx ON accounts(cycle_status) WHERE cycle_status = 'active';

COMMENT ON COLUMN accounts.starting_capital IS 'KRW BIGINT (ADR-002)';
COMMENT ON COLUMN accounts.epoch_kst IS 'Monday 00:00 KST that anchors week_num computation (ADR-006)';
