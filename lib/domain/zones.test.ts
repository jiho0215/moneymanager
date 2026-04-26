import { describe, expect, it } from 'vitest';
import { transferFreeToExperiment, applyBonusMatch } from './zones';
import type { ExperimentAccount } from './types';

function acc(overrides: Partial<ExperimentAccount> = {}): ExperimentAccount {
  return {
    id: 'a1',
    freeBalance: 8000,
    experimentBalance: 2000,
    bonusBalance: 0,
    pendingInterest: 0,
    weeklyGrowthRateBp: 1000,
    bonusMatchRateBp: 2000,
    cycleNumber: 1,
    weekNumStarted: 0,
    lastClaimedWeekNum: null,
    cycleStatus: 'active',
    ...overrides,
  };
}

describe('transferFreeToExperiment', () => {
  it('moves amount from free to experiment + sets lockUntilWeek', () => {
    const r = transferFreeToExperiment({ account: acc(), amount: 1000, currentWeekNum: 2 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.newAccount.freeBalance).toBe(7000);
      expect(r.newAccount.experimentBalance).toBe(3000);
      expect(r.lockUntilWeek).toBe(3);
    }
  });

  it('refuses zero/negative amount', () => {
    const r = transferFreeToExperiment({ account: acc(), amount: 0, currentWeekNum: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('invalid_amount');
  });

  it('refuses if amount exceeds free balance', () => {
    const r = transferFreeToExperiment({ account: acc({ freeBalance: 500 }), amount: 1000, currentWeekNum: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('insufficient_balance');
  });

  it('refuses on graduated cycle', () => {
    const r = transferFreeToExperiment({ account: acc({ cycleStatus: 'graduated' }), amount: 1000, currentWeekNum: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('cycle_ended');
  });
});

describe('applyBonusMatch', () => {
  it('matches at configured rate (20% default)', () => {
    expect(applyBonusMatch({ account: acc(), experimentDepositAmount: 5000 }).bonusAmount).toBe(1000);
  });

  it('floor on partial krw', () => {
    expect(applyBonusMatch({ account: acc(), experimentDepositAmount: 999 }).bonusAmount).toBe(199);
  });

  it('zero bonus when rate is 0', () => {
    expect(applyBonusMatch({ account: acc({ bonusMatchRateBp: 0 }), experimentDepositAmount: 5000 }).bonusAmount).toBe(0);
  });

  it('zero bonus on non-positive deposit', () => {
    expect(applyBonusMatch({ account: acc(), experimentDepositAmount: 0 }).bonusAmount).toBe(0);
  });
});
