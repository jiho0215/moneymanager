/**
 * Compound interest math (ADR-002 BIGINT integer KRW).
 * Pure functions — no IO. All inputs/outputs are integers.
 */

const MAX_BACK_INTEREST_WEEKS = 4;

export function applyWeeklyInterest(balance: number, rateBp: number): number {
  if (balance < 0) {
    throw new Error(`applyWeeklyInterest: balance must be non-negative, got ${balance}`);
  }
  if (rateBp < 0) {
    throw new Error(`applyWeeklyInterest: rateBp must be non-negative, got ${rateBp}`);
  }
  const interest = Math.floor((balance * rateBp) / 10000);
  return balance + interest;
}

export type PendingInterestInput = {
  experimentBalance: number;
  rateBp: number;
  lastClaimedWeekNum: number | null;
  currentWeekNum: number;
  weekNumStarted: number;
};

export type PendingInterestResult = {
  pendingAmount: number;
  expiredAmount: number;
  weeksToClaim: number;
};

export function computePendingInterest(input: PendingInterestInput): PendingInterestResult {
  const { experimentBalance, rateBp, lastClaimedWeekNum, currentWeekNum, weekNumStarted } = input;

  const baselineWeek = lastClaimedWeekNum ?? weekNumStarted;
  const weeksElapsed = currentWeekNum - baselineWeek;

  if (weeksElapsed <= 0) {
    return { pendingAmount: 0, expiredAmount: 0, weeksToClaim: 0 };
  }

  const claimableWeeks = Math.min(weeksElapsed, MAX_BACK_INTEREST_WEEKS);
  const expiredWeeks = Math.max(0, weeksElapsed - MAX_BACK_INTEREST_WEEKS);

  let runningBalance = experimentBalance;
  let pendingAmount = 0;
  for (let i = 0; i < claimableWeeks; i += 1) {
    const next = applyWeeklyInterest(runningBalance, rateBp);
    pendingAmount += next - runningBalance;
    runningBalance = next;
  }

  let expiredBalance = runningBalance;
  let expiredAmount = 0;
  for (let i = 0; i < expiredWeeks; i += 1) {
    const next = applyWeeklyInterest(expiredBalance, rateBp);
    expiredAmount += next - expiredBalance;
    expiredBalance = next;
  }

  return {
    pendingAmount,
    expiredAmount,
    weeksToClaim: claimableWeeks,
  };
}
