---
epicId: compound-learning-elementary
ticketId: T3-domain
status: planned
implBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "needs lib/domain/types.ts skeleton, eslint domain-no-io rule, Vitest setup"
deployBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "deployable as part of T1's foundation; no separate runtime artifact"
createdAt: 2026-04-25T00:00:00Z
---

# T3-domain — Pure Domain Logic (Compound, Claim, MathGen, Zones)

## §1 Back-reference

Part of epic [compound-learning-elementary](spike-plan.md). See [spike-plan §7](spike-plan.md#7-tickets) for sibling tickets and current status.

## §2 This Ticket's Role in the Big Picture

T3 은 epic의 **수학적 정확성과 학습 메시지의 핵심**. `lib/domain/` 안의 순수 함수만 다룬다 — DB, HTTP, 시간, random 모두 모름 (ADR-003). 이 분리 덕분에 T3 는 T2와 병렬 작업 가능하며, 단위 테스트가 인프라 없이 millisecond 단위로 끝난다.

T3 가 보장하는 것:
- "주 10% 복리"가 정확히 10% — `floor(balance × 1.10)` 결정적 적용 (ADR-002)
- 8주 후 10000원 → **정확히 21435원** (1.10⁸ floor-stepped)
- 누락된 주의 이자 누적, 5주 이상 expire (학습 메시지: 의식의 가치)
- 산수 문제가 7-8주 진행하면서 **단조 증가** 난이도 (자녀 지루함 방지)
- 같은 문제 연속 안 나옴

이게 안 되면 학습 메시지 무력화 — "어 잔액이 어제랑 다르네?" 라는 자녀 한 마디로 시스템 신뢰 붕괴.

## §3 Relevant API Contract Slice

T3 는 외부 API 노출 안 함. **내부 도메인 함수**만:

```typescript
// lib/domain/types.ts (T1 skeleton 채움)
export type ExperimentAccount = {
  id: string;
  experimentBalance: number;        // BIGINT-safe number
  freeBalance: number;
  bonusBalance: number;
  pendingInterest: number;
  weeklyGrowthRateBp: number;       // basis points: 1000 = 10.00%
  bonusMatchRateBp: number;
  cycleNumber: number;
  weekNumStarted: number;           // 이 cycle 시작 시점 week_num
  lastClaimedWeekNum: number | null;
  cycleStatus: 'active' | 'graduated' | 'reset';
};

export type Problem = {
  id: string;                       // server-issued UUID
  type: 'general' | 'finance';
  question: string;
  expectedAnswer: string;
  choices?: string[];               // multiple choice (낮은 학년) 또는 free input
  difficulty: number;               // 1-10
};

export type ClaimResult =
  | { ok: true; newExperimentBalance: number; growthThisWeek: number; pendingClaimsRemaining: number }
  | { ok: false; reason:
      | 'wrong_answer'
      | 'already_claimed'
      | 'not_yet_unlockable'
      | 'attempts_exhausted'
      | 'expired_pending'
      | 'invalid_problem_id'
    };

// lib/domain/compound.ts
export function applyWeeklyInterest(balance: number, rateBp: number): number;
export function computePendingInterest(input: {
  experimentBalance: number;
  rateBp: number;
  lastClaimedWeekNum: number | null;
  currentWeekNum: number;
  weekNumStarted: number;
  maxBackInterestWeeks: 4;          // hardcoded cap (Success Criterion §1.2)
}): { pendingAmount: number; expiredAmount: number };

// lib/domain/claim.ts
export function canClaim(account: ExperimentAccount, currentWeekNum: number):
  | { ok: true }
  | { ok: false; reason: 'already_claimed' | 'not_yet_unlockable' | 'expired_pending' | 'cycle_ended' };

export function grantClaim(input: {
  account: ExperimentAccount;
  problem: Problem;
  userAnswer: string;
  currentWeekNum: number;
  attemptNumberThisWeek: number;     // 1-based, 5+ → exhausted
}): ClaimResult;

// lib/domain/mathgen.ts
export function generateProblem(input: {
  seed: string;                     // 인자 주입 (random 무관)
  weekNum: number;                  // 난이도 결정
  grade: 5 | 6;                     // 학년별 추가 조정
  recentProblemTypes: ('general' | 'finance')[];  // 직전 N개 (연속 방지)
  accountBalance?: number;          // finance 문제용
}): Problem;

export function validateAnswer(problem: Problem, userAnswer: string): boolean;

// lib/domain/zones.ts
export function transferFreeToExperiment(input: {
  account: ExperimentAccount;
  amount: number;
  currentWeekNum: number;
}): { newAccount: ExperimentAccount; lockUntilWeek: number };

export function transferExperimentToFree(input: {
  account: ExperimentAccount;
  amount: number;
  currentWeekNum: number;
}): { ok: true; newAccount: ExperimentAccount } | { ok: false; reason: 'still_locked' | 'insufficient_balance' };

export function applyBonusMatch(input: {
  account: ExperimentAccount;
  experimentDepositAmount: number;
}): { bonusAmount: number };
```

## §4 Relevant Migrations

T3 는 schema 안 건드림. T1 의 schema를 사용만.

## §5 Relevant Observability Hooks

T3 자체는 IO 없으므로 metric 직접 emit 안 함. 그러나 **소비자 측 (T4, T5)** 에서 다음을 logger에 기록:

- `mathgen.failure_total` (T1에 정의된 metric) — `generateProblem` 이 throw하면 호출자(T4)가 +1
- 도메인 함수의 `log.debug` 출력 (개발용, prod에서는 disabled)

## §6 Implementation Notes

<!-- BEGIN AUTO-GENERATED IMPL LOG -->
_(populated by /implement)_
<!-- END AUTO-GENERATED IMPL LOG -->

## §7 Discoveries / Reference-doc Corrections

_(empty until /implement runs)_

---

## Math Problem Mix (User-confirmed)

| Type | 비율 | 예시 (5학년 기준) |
|---|---|---|
| **General** | 70% | "분수 3/4 + 1/2 = ?", "60의 25%는?", "x + 8 = 15에서 x는?" |
| **Finance** | 30% | "10000원의 10%는?", "지금 잔액 12100원, 1주 후 10% 이자가 붙으면 얼마?", "20% 이자가 1주 동안 12100원에 붙으면 얼마 됨?" |

### Difficulty Progression

`difficulty(weekNum, grade) = clamp(weekNum + (grade - 5) * 2, 1, 10)`

- Week 1 학년 5: difficulty 1 (단순 곱셈)
- Week 8 학년 5: difficulty 8 (소수, 다단계)
- Week 8 학년 6: difficulty 10 (간단 방정식 + 백분율)

### No-Repeat Rule

`recentProblemTypes` 가 직전 N=2 개를 추적. `generateProblem` 은 같은 type을 3연속 안 만듦 (general general → next must be finance).

---

## Acceptance Criteria

### Unit Tests (모두 §8.3.1 만족)

- [ ] `applyWeeklyInterest(10000, 1000) === 11000`
- [ ] `applyWeeklyInterest(10001, 1000) === 11001`
- [ ] `applyWeeklyInterest(0, 1000) === 0`
- [ ] `applyWeeklyInterest(-1, 1000)` throws (defensive)
- [ ] **8주 시퀀스 정확성**: `[1..8].reduce(b => applyWeeklyInterest(b, 1000), 10000) === 21435`
- [ ] Property test (1000+ iterations): `applyWeeklyInterest(b, 1000) >= b` AND `<= floor(b * 1.10) + 1` for b ∈ [0, 10_000_000]
- [ ] Property test: 결정적 — 같은 입력 → 같은 출력 (deterministic)
- [ ] `canClaim` returns `{ok:false, reason:'already_claimed'}` if `account.lastClaimedWeekNum === currentWeekNum`
- [ ] `canClaim` returns `{ok:false, reason:'not_yet_unlockable'}` if `currentWeekNum < weekNumStarted + 1`
- [ ] `canClaim` returns `{ok:false, reason:'expired_pending'}` if `currentWeekNum - lastClaimedWeekNum > 5` (5주 이상 누락)
- [ ] `computePendingInterest`: 4주 누락 시 4주분 누적, 5주 누락 시 1주분 expired + 4주분 pending
- [ ] `grantClaim` 오답 시 `{ok:false, reason:'wrong_answer'}`, `attempt_exhausted` (5+) 시 락
- [ ] `generateProblem`: 100 회 반복 시 같은 문제 연속 0회, type general/finance 비율이 ±5% 이내 70/30
- [ ] `generateProblem` 결정적: 같은 (seed, weekNum, grade) → 같은 Problem
- [ ] `validateAnswer`: 공백/대소문자/콤마 트리밍 후 비교
- [ ] `transferFreeToExperiment`: free 차감 + experiment 증가 + lockUntilWeek = currentWeekNum + 1
- [ ] `transferExperimentToFree`: lock 해제 전 시도 시 `still_locked`
- [ ] `applyBonusMatch`: experiment 증가분의 `bonusMatchRateBp / 10000` 계산 정확

### Coverage

- [ ] `lib/domain/**` branch coverage ≥ 90% (Vitest c8)
- [ ] `lib/domain/**` 단위 테스트 0개의 `@supabase/*` import (CI 검증)
- [ ] 모든 함수에 입력 인자 주입 — 시간/random 호출 없음 (CI 검증: `domain-no-io` lint)

### Code Quality

- [ ] 모든 도메인 함수는 함수 30 LOC 이하 (가이드)
- [ ] 모든 export된 함수는 JSDoc 1줄 (목적만)
- [ ] 도메인 type 변경 시 mapper (T1) 변경 없이 깨지지 않음 (decoupled)

### Multi-agent Review

- [ ] 5명의 multi-agent review 통과 (consensus 0 issues 또는 dismissible only)

## Estimated Complexity

중간. T1 위에 얇게 얹힘. 가장 까다로운 부분:
- `computePendingInterest` 의 4주 cap + 5주 expire 로직 (off-by-one 위험)
- `generateProblem` 의 결정성 + 난이도 단조 증가 + no-repeat 동시 만족
- Property test 셋업 (fast-check)

T3 가 끝나면 T4 (kid flow) 와 T5 (guardian flow) 가 매끄럽게 진행됨.
