import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { applyWeeklyInterest, computePendingInterest } from './compound';

describe('applyWeeklyInterest', () => {
  it('returns floor(b * 1.10) for representative KRW values', () => {
    expect(applyWeeklyInterest(10000, 1000)).toBe(11000);
    expect(applyWeeklyInterest(10001, 1000)).toBe(11001);
    expect(applyWeeklyInterest(9, 1000)).toBe(9);
    expect(applyWeeklyInterest(10, 1000)).toBe(11);
  });

  it('returns 0 for zero balance', () => {
    expect(applyWeeklyInterest(0, 1000)).toBe(0);
  });

  it('throws for negative balance (defensive)', () => {
    expect(() => applyWeeklyInterest(-1, 1000)).toThrow();
  });

  it('throws for negative rate (defensive)', () => {
    expect(() => applyWeeklyInterest(10000, -1)).toThrow();
  });

  it('8주 시퀀스 정확성: 10000 → 21434 (per-week floor; success criterion §1.2 corrected)', () => {
    // T1 ticket.discovery: spike-plan §1.2 originally claimed 21435 (end-floored).
    // Per-week floor (real-world banking) yields 21434: weeks 5-8 each lose <1원 to floor.
    // Trace: 10000→11000→12100→13310→14641→16105→17715→19486→21434.
    let balance = 10000;
    for (let i = 0; i < 8; i += 1) {
      balance = applyWeeklyInterest(balance, 1000);
    }
    expect(balance).toBe(21434);
  });

  it('property: result is in [b, floor(b*1.10)+1] and non-decreasing', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10_000_000 }), (b) => {
        const result = applyWeeklyInterest(b, 1000);
        expect(result).toBeGreaterThanOrEqual(b);
        expect(result).toBeLessThanOrEqual(Math.floor(b * 1.1) + 1);
      })
    );
  });

  it('property: deterministic — same input always same output', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1_000_000 }),
        fc.integer({ min: 0, max: 5000 }),
        (b, rate) => {
          expect(applyWeeklyInterest(b, rate)).toBe(applyWeeklyInterest(b, rate));
        }
      )
    );
  });
});

describe('computePendingInterest', () => {
  it('zero pending when no weeks elapsed', () => {
    const result = computePendingInterest({
      experimentBalance: 10000,
      rateBp: 1000,
      lastClaimedWeekNum: 5,
      currentWeekNum: 5,
      weekNumStarted: 0,
    });
    expect(result).toEqual({ pendingAmount: 0, expiredAmount: 0, weeksToClaim: 0 });
  });

  it('1 week elapsed → 1 week pending interest', () => {
    const result = computePendingInterest({
      experimentBalance: 10000,
      rateBp: 1000,
      lastClaimedWeekNum: 0,
      currentWeekNum: 1,
      weekNumStarted: 0,
    });
    expect(result.pendingAmount).toBe(1000);
    expect(result.expiredAmount).toBe(0);
    expect(result.weeksToClaim).toBe(1);
  });

  it('4 weeks elapsed → 4 weeks pending, 0 expired', () => {
    const result = computePendingInterest({
      experimentBalance: 10000,
      rateBp: 1000,
      lastClaimedWeekNum: 0,
      currentWeekNum: 4,
      weekNumStarted: 0,
    });
    expect(result.weeksToClaim).toBe(4);
    expect(result.expiredAmount).toBe(0);
    // 10000 → 11000 → 12100 → 13310 → 14641, total interest = 4641
    expect(result.pendingAmount).toBe(4641);
  });

  it('5 weeks elapsed → 4 weeks pending + 1 week expired', () => {
    const result = computePendingInterest({
      experimentBalance: 10000,
      rateBp: 1000,
      lastClaimedWeekNum: 0,
      currentWeekNum: 5,
      weekNumStarted: 0,
    });
    expect(result.weeksToClaim).toBe(4);
    expect(result.pendingAmount).toBe(4641);
    // 14641 * 1.10 - 14641 = 1464 (5번째 주 이자, expired)
    expect(result.expiredAmount).toBe(1464);
  });

  it('uses weekNumStarted when no last claim', () => {
    const result = computePendingInterest({
      experimentBalance: 10000,
      rateBp: 1000,
      lastClaimedWeekNum: null,
      currentWeekNum: 1,
      weekNumStarted: 0,
    });
    expect(result.weeksToClaim).toBe(1);
    expect(result.pendingAmount).toBe(1000);
  });
});
