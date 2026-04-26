-- T1-foundation migration 001: families table
-- ADR-001 (multi-tenant from start; family is the tenant unit)

CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ NULL
);

CREATE INDEX families_deleted_at_idx ON families(deleted_at) WHERE deleted_at IS NULL;
