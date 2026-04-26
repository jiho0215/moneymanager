import type { CanClaimResult, ExperimentAccount } from './types';

const MAX_BACK_INTEREST_WEEKS = 4;
const MAX_ATTEMPTS_PER_WEEK = 5;

export function canClaim(account: ExperimentAccount, currentWeekNum: number): CanClaimResult {
  if (account.cycleStatus !== 'active') {
    return { ok: false, reason: 'cycle_ended' };
  }

  if (currentWeekNum < account.weekNumStarted + 1) {
    return { ok: false, reason: 'not_yet_unlockable' };
  }

  if (
    account.lastClaimedWeekNum !== null &&
    account.lastClaimedWeekNum >= currentWeekNum
  ) {
    return { ok: false, reason: 'already_claimed' };
  }

  const baselineWeek = account.lastClaimedWeekNum ?? account.weekNumStarted;
  const weeksElapsed = currentWeekNum - baselineWeek;
  if (weeksElapsed > MAX_BACK_INTEREST_WEEKS + 1) {
    return { ok: false, reason: 'expired_pending' };
  }

  return { ok: true };
}

export function isAttemptExhausted(attemptNumberThisWeek: number): boolean {
  return attemptNumberThisWeek > MAX_ATTEMPTS_PER_WEEK;
}

export const CLAIM_CONSTANTS = {
  MAX_BACK_INTEREST_WEEKS,
  MAX_ATTEMPTS_PER_WEEK,
} as const;
