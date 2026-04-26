import type { ExperimentAccount } from './types';

export type TransferResult =
  | { ok: true; newAccount: ExperimentAccount; lockUntilWeek?: number }
  | { ok: false; reason: 'insufficient_balance' | 'invalid_amount' | 'still_locked' | 'cycle_ended' };

export function transferFreeToExperiment(input: {
  account: ExperimentAccount;
  amount: number;
  currentWeekNum: number;
}): TransferResult {
  const { account, amount, currentWeekNum } = input;

  if (account.cycleStatus !== 'active') {
    return { ok: false, reason: 'cycle_ended' };
  }
  if (amount <= 0) {
    return { ok: false, reason: 'invalid_amount' };
  }
  if (amount > account.freeBalance) {
    return { ok: false, reason: 'insufficient_balance' };
  }

  return {
    ok: true,
    newAccount: {
      ...account,
      freeBalance: account.freeBalance - amount,
      experimentBalance: account.experimentBalance + amount,
    },
    lockUntilWeek: currentWeekNum + 1,
  };
}

export function applyBonusMatch(input: {
  account: ExperimentAccount;
  experimentDepositAmount: number;
}): { bonusAmount: number } {
  const { account, experimentDepositAmount } = input;
  if (experimentDepositAmount <= 0 || account.bonusMatchRateBp <= 0) {
    return { bonusAmount: 0 };
  }
  return {
    bonusAmount: Math.floor((experimentDepositAmount * account.bonusMatchRateBp) / 10000),
  };
}
