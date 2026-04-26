import { applyWeeklyInterest } from '@/lib/domain/compound';
import type { ChartPoint } from '@/lib/ui/chart';

export type WeeklySnapshotRow = {
  week_num: number;
  free_balance: number;
  experiment_balance: number;
  bonus_balance: number;
  was_claimed_this_week: boolean;
};

function snapshotTotal(s: WeeklySnapshotRow): number {
  return Number(s.free_balance) + Number(s.experiment_balance) + Number(s.bonus_balance);
}

/**
 * Build chart series from weekly snapshots, plus a "claimed every week" counterfactual.
 * Both lines are the total passbook balance (원금 + 이자), since the kid sees one number.
 */
export function buildHistorySeries(input: {
  snapshots: WeeklySnapshotRow[];
  weeklyGrowthRateBp: number;
}): ChartPoint[] {
  const { snapshots, weeklyGrowthRateBp } = input;
  if (snapshots.length === 0) return [];

  const sorted = [...snapshots].sort((a, b) => a.week_num - b.week_num);
  const startTotal = snapshotTotal(sorted[0]!);

  let cf = startTotal;
  return sorted.map((s, i) => {
    if (i > 0) cf = applyWeeklyInterest(cf, weeklyGrowthRateBp);
    return {
      x: s.week_num,
      actual: snapshotTotal(s),
      counterfactual: cf,
      claimed: s.was_claimed_this_week,
    };
  });
}
