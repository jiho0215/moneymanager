-- T2 migration 012: kid_login_codes (guardian-issued single-use codes)
CREATE TABLE kid_login_codes (
  code TEXT PRIMARY KEY CHECK (length(code) = 6),
  kid_membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX kid_login_codes_kid_idx ON kid_login_codes(kid_membership_id);
CREATE INDEX kid_login_codes_family_idx ON kid_login_codes(family_id);
ALTER TABLE kid_login_codes ENABLE ROW LEVEL SECURITY;
-- guardian sees own family's codes, kid never selects (server-side only)
CREATE POLICY kid_login_codes_select ON kid_login_codes FOR SELECT USING (
  family_id = current_user_family_id()
  AND EXISTS (SELECT 1 FROM memberships WHERE user_id = auth.uid() AND family_id = kid_login_codes.family_id AND role = 'guardian')
);
