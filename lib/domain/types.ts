/**
 * Domain value types — plain TypeScript, no DB/HTTP/time/random imports (ADR-003).
 * Mappers in lib/db/mappers.ts convert between Supabase Row types and these.
 */

export type AgeTier = 'elementary' | 'middle' | 'high';
export type Role = 'guardian' | 'kid';
export type Zone = 'free' | 'experiment' | 'bonus';
export type CycleStatus = 'active' | 'graduated' | 'reset';

export type ProblemType = 'general' | 'finance';

export type TransactionType =
  | 'initial_deposit'
  | 'free_withdraw'
  | 'free_to_experiment'
  | 'experiment_to_free'
  | 'interest_accrued'
  | 'interest_claimed'
  | 'bonus_match'
  | 'bonus_match_revert'
  | 'manual_adjustment';

export type ExperimentAccount = {
  id: string;
  freeBalance: number;
  experimentBalance: number;
  bonusBalance: number;
  pendingInterest: number;
  weeklyGrowthRateBp: number;
  bonusMatchRateBp: number;
  cycleNumber: number;
  weekNumStarted: number;
  lastClaimedWeekNum: number | null;
  cycleStatus: CycleStatus;
};

export type Problem = {
  id: string;
  type: ProblemType;
  question: string;
  expectedAnswer: string;
  choices?: string[];
  difficulty: number;
};

export type ClaimResult =
  | {
      ok: true;
      newExperimentBalance: number;
      growthThisWeek: number;
      pendingClaimsRemaining: number;
    }
  | {
      ok: false;
      reason:
        | 'wrong_answer'
        | 'already_claimed'
        | 'not_yet_unlockable'
        | 'attempts_exhausted'
        | 'expired_pending'
        | 'invalid_problem_id';
    };

export type CanClaimResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'already_claimed' | 'not_yet_unlockable' | 'expired_pending' | 'cycle_ended';
    };
