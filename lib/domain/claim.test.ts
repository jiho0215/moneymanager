import { describe, expect, it } from 'vitest';
import { canClaim, isAttemptExhausted } from './claim';
import type { ExperimentAccount } from './types';

function makeAccount(overrides: Partial<ExperimentAccount> = {}): ExperimentAccount {
  return {
    id: 'acc_test',
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

describe('canClaim', () => {
  it('returns ok when current week is past start and not yet claimed', () => {
    const account = makeAccount({ weekNumStarted: 0, lastClaimedWeekNum: null });
    expect(canClaim(account, 1)).toEqual({ ok: true });
  });

  it('returns not_yet_unlockable on the start week', () => {
    const account = makeAccount({ weekNumStarted: 0 });
    expect(canClaim(account, 0)).toEqual({ ok: false, reason: 'not_yet_unlockable' });
  });

  it('returns already_claimed when lastClaimedWeekNum >= currentWeekNum', () => {
    const account = makeAccount({ weekNumStarted: 0, lastClaimedWeekNum: 3 });
    expect(canClaim(account, 3)).toEqual({ ok: false, reason: 'already_claimed' });
  });

  it('returns expired_pending when more than 5 weeks unclaimed', () => {
    const account = makeAccount({ weekNumStarted: 0, lastClaimedWeekNum: 0 });
    expect(canClaim(account, 6)).toEqual({ ok: false, reason: 'expired_pending' });
  });

  it('returns cycle_ended when cycle is graduated', () => {
    const account = makeAccount({ cycleStatus: 'graduated' });
    expect(canClaim(account, 5)).toEqual({ ok: false, reason: 'cycle_ended' });
  });
});

describe('isAttemptExhausted', () => {
  it('false at attempt 1-5', () => {
    expect(isAttemptExhausted(1)).toBe(false);
    expect(isAttemptExhausted(5)).toBe(false);
  });

  it('true at attempt 6+', () => {
    expect(isAttemptExhausted(6)).toBe(true);
    expect(isAttemptExhausted(100)).toBe(true);
  });
});
