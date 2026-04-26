DROP FUNCTION IF EXISTS finalize_kid_choices(UUID, BIGINT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS finalize_parent_recommendations(UUID, BIGINT, TEXT, INTEGER, INTEGER);

ALTER TABLE accounts
  DROP COLUMN IF EXISTS recommended_scenario,
  DROP COLUMN IF EXISTS recommended_total_weeks,
  DROP COLUMN IF EXISTS recommended_starting_capital,
  DROP COLUMN IF EXISTS scenario,
  DROP COLUMN IF EXISTS total_weeks,
  DROP COLUMN IF EXISTS setup_state;
