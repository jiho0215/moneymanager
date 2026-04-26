-- Migration 029: allow memberships.user_id to be NULL.
-- Kid memberships are created in 'parent_setup_pending' before the kid claims
-- their own auth identity at /join/{token}. user_id stays NULL until claim.

ALTER TABLE memberships
  ALTER COLUMN user_id DROP NOT NULL;

-- Sanity: a guardian membership must always have a user_id
-- (only kids are allowed to be NULL while pending).
ALTER TABLE memberships
  ADD CONSTRAINT guardian_must_have_user_id
  CHECK (role <> 'guardian' OR user_id IS NOT NULL);
