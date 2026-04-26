-- Reinstate the constraint (would fail if any kid row has access_code IS NULL).
ALTER TABLE memberships
  ADD CONSTRAINT kid_must_have_access_code
  CHECK (role <> 'kid' OR access_code IS NOT NULL);
