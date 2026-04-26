-- T1-foundation migration 002: memberships (users ↔ families with roles)

CREATE TYPE membership_role AS ENUM ('guardian', 'kid');
CREATE TYPE age_tier AS ENUM ('elementary', 'middle', 'high');

CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role membership_role NOT NULL,
  display_name TEXT NOT NULL CHECK (length(display_name) BETWEEN 1 AND 50),
  age_tier age_tier NULL,
  grade SMALLINT NULL CHECK (grade IS NULL OR grade BETWEEN 1 AND 12),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (family_id, user_id),
  CONSTRAINT kid_must_have_age_tier CHECK (
    role = 'guardian' OR (role = 'kid' AND age_tier IS NOT NULL AND grade IS NOT NULL)
  )
);

CREATE INDEX memberships_user_idx ON memberships(user_id);
CREATE INDEX memberships_family_idx ON memberships(family_id);
