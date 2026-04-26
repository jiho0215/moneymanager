import { describe, expect, it } from 'vitest';
import { buildHistorySeries } from './history';

describe('buildHistorySeries (통장 model)', () => {
  it('returns empty for no snapshots', () => {
    expect(buildHistorySeries({ snapshots: [], weeklyGrowthRateBp: 1000 })).toEqual([]);
  });

  it('counterfactual matches actual when total grows 10% each week (claimed every week)', () => {
    // Total = free + exp + bonus. Each week the total compounds 10% (interest credited to exp).
    const snapshots = [
      { week_num: 0, free_balance: 10000, experiment_balance: 0, bonus_balance: 0, was_claimed_this_week: false },
      { week_num: 1, free_balance: 10000, experiment_balance: 1000, bonus_balance: 0, was_claimed_this_week: true },
      { week_num: 2, free_balance: 10000, experiment_balance: 2100, bonus_balance: 0, was_claimed_this_week: true },
    ];
    const series = buildHistorySeries({ snapshots, weeklyGrowthRateBp: 1000 });
    expect(series[0]?.counterfactual).toBe(10000);
    expect(series[1]?.counterfactual).toBe(11000);
    expect(series[2]?.counterfactual).toBe(12100);
    series.forEach((p) => expect(p.actual).toBe(p.counterfactual));
  });

  it('opportunity cost: counterfactual exceeds actual when weeks skipped', () => {
    const snapshots = [
      { week_num: 0, free_balance: 10000, experiment_balance: 0, bonus_balance: 0, was_claimed_this_week: false },
      { week_num: 1, free_balance: 10000, experiment_balance: 0, bonus_balance: 0, was_claimed_this_week: false },
      { week_num: 2, free_balance: 10000, experiment_balance: 0, bonus_balance: 0, was_claimed_this_week: false },
    ];
    const series = buildHistorySeries({ snapshots, weeklyGrowthRateBp: 1000 });
    expect(series[0]?.actual).toBe(10000);
    expect(series[0]?.counterfactual).toBe(10000);
    expect(series[1]?.counterfactual).toBe(11000);
    expect(series[2]?.counterfactual).toBe(12100);
    series.forEach((p) => expect(p.counterfactual).toBeGreaterThanOrEqual(p.actual));
  });
});
