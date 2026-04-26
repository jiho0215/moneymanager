-- T1-foundation migration 006: claim_attempts (math game tries + lockout)

CREATE TABLE claim_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  week_num INTEGER NOT NULL,
  problem_id TEXT NOT NULL,
  problem_data JSONB NOT NULL,
  user_answer TEXT NULL,
  is_correct BOOLEAN NULL,
  attempt_number_this_week INTEGER NOT NULL CHECK (attempt_number_this_week >= 1),
  is_locked_out BOOLEAN NOT NULL DEFAULT FALSE,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX claim_attempts_account_week_idx ON claim_attempts(account_id, week_num);
CREATE INDEX claim_attempts_account_problem_idx ON claim_attempts(account_id, problem_id);
