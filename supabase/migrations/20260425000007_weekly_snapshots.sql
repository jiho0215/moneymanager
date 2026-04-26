-- T1-foundation migration 007: weekly_snapshots (chart data, written atomically with claim)

CREATE TABLE weekly_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  cycle_number INTEGER NOT NULL,
  week_num INTEGER NOT NULL,
  free_balance BIGINT NOT NULL,
  experiment_balance BIGINT NOT NULL,
  bonus_balance BIGINT NOT NULL,
  total_balance BIGINT NOT NULL GENERATED ALWAYS AS (free_balance + experiment_balance + bonus_balance) STORED,
  pending_interest BIGINT NOT NULL DEFAULT 0,
  was_claimed_this_week BOOLEAN NOT NULL DEFAULT FALSE,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, cycle_number, week_num)
);

CREATE INDEX weekly_snapshots_chart_idx ON weekly_snapshots(account_id, cycle_number, week_num);

COMMENT ON TABLE weekly_snapshots IS 'Cache for chart rendering. Written atomically with claim in process_claim RPC (ADR-007).';
