import { describe, expect, it } from 'vitest';
import { buildHistorySeries } from './history';

describe('buildHistorySeries', () => {
  it('returns empty for no snapshots', () => {
    expect(buildHistorySeries({ snapshots: [], weeklyGrowthRateBp: 1000 })).toEqual([]);
  });

  it('counterfactual matches actual when claimed every week', () => {
    const snapshots = [
      { week_num: 0, free_balance: 8000, experiment_balance: 2000, bonus_balance: 0, was_claimed_this_week: false },
      { week_num: 1, free_balance: 8000, experiment_balance: 2200, bonus_balance: 0, was_claimed_this_week: true },
      { week_num: 2, free_balance: 8000, experiment_balance: 2420, bonus_balance: 0, was_claimed_this_week: true },
    ];
    const series = buildHistorySeries({ snapshots, weeklyGrowthRateBp: 1000 });
    expect(series[0]?.counterfactual).toBe(2000);
    expect(series[1]?.counterfactual).toBe(2200);
    expect(series[2]?.counterfactual).toBe(2420);
    series.forEach((p) => expect(p.actual).toBe(p.counterfactual));
  });

  it('opportunity cost: counterfactual exceeds actual when weeks skipped', () => {
    const snapshots = [
      { week_num: 0, free_balance: 0, experiment_balance: 10000, bonus_balance: 0, was_claimed_this_week: false },
      { week_num: 1, free_balance: 0, experiment_balance: 10000, bonus_balance: 0, was_claimed_this_week: false },
      { week_num: 2, free_balance: 0, experiment_balance: 10000, bonus_balance: 0, was_claimed_this_week: false },
    ];
    const series = buildHistorySeries({ snapshots, weeklyGrowthRateBp: 1000 });
    expect(series[0]?.counterfactual).toBe(10000);
    expect(series[1]?.counterfactual).toBe(11000);
    expect(series[2]?.counterfactual).toBe(12100);
    series.forEach((p) => expect(p.counterfactual).toBeGreaterThanOrEqual(p.actual));
  });
});
