DROP FUNCTION IF EXISTS rotate_kid_access_code(UUID, UUID);
DROP FUNCTION IF EXISTS generate_unique_access_code();
ALTER TABLE memberships DROP CONSTRAINT IF EXISTS kid_must_have_access_code;
ALTER TABLE memberships DROP COLUMN IF EXISTS access_code;
