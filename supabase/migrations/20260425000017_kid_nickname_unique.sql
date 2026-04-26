-- Migration 017: enforce globally unique kid nicknames
-- Since kid login switched from access_code → nickname + PIN,
-- nicknames must be unambiguous across all families.

CREATE UNIQUE INDEX kid_nickname_unique
ON memberships (display_name)
WHERE role = 'kid';
