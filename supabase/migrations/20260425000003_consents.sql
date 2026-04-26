-- T1-foundation migration 003: PIPA Article 22 evidence

CREATE TABLE consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  accepted_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  consent_text TEXT NOT NULL,
  consent_version TEXT NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address TEXT NULL,
  user_agent TEXT NULL
);

CREATE INDEX consents_family_idx ON consents(family_id);
COMMENT ON TABLE consents IS 'PIPA Article 22 evidence — append-only legal record. Never UPDATE/DELETE.';
