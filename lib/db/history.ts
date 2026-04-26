import { applyWeeklyInterest } from '@/lib/domain/compound';
import type { ChartPoint } from '@/lib/ui/chart';

export type WeeklySnapshotRow = {
  week_num: number;
  free_balance: number;
  experiment_balance: number;
  bonus_balance: number;
  was_claimed_this_week: boolean;
};

/**
 * Build chart series from snapshots + an "if claimed every week" counterfactual.
 * The counterfactual starts from the experiment_balance at week 0
 * and applies weekly interest with no skips.
 */
export function buildHistorySeries(input: {
  snapshots: WeeklySnapshotRow[];
  weeklyGrowthRateBp: number;
}): ChartPoint[] {
  const { snapshots, weeklyGrowthRateBp } = input;
  if (snapshots.length === 0) return [];

  const sorted = [...snapshots].sort((a, b) => a.week_num - b.week_num);
  const startBalance = Number(sorted[0]!.experiment_balance);

  let cf = startBalance;
  return sorted.map((s, i) => {
    if (i > 0) cf = applyWeeklyInterest(cf, weeklyGrowthRateBp);
    return {
      x: s.week_num,
      actual: Number(s.experiment_balance),
      counterfactual: cf,
      claimed: s.was_claimed_this_week,
    };
  });
}
