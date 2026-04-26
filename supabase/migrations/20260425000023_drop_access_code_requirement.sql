-- Migration 023: drop the legacy 'kid_must_have_access_code' check constraint
-- Kid login moved from 6-digit access codes to nickname + PIN, but the
-- post-backfill check from migration 016 was still rejecting new signups.
-- Column itself stays (existing kid rows still have codes; data preserved).

ALTER TABLE memberships
  DROP CONSTRAINT IF EXISTS kid_must_have_access_code;
