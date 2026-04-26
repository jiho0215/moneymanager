---
epicId: compound-learning-elementary
ticketId: T4-kid-flow
status: planned
implBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "needs schema, RLS, RPC, route group skeleton"
  - ticketId: T2-auth-family
    kind: hard
    reason: "needs kid JWT session for RLS context (auth.uid())"
  - ticketId: T3-domain
    kind: hard
    reason: "Server Actions call applyWeeklyInterest, generateProblem, canClaim, grantClaim"
deployBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "T1's deployed schema + RPC required"
  - ticketId: T2-auth-family
    kind: hard
    reason: "kid login session must be deployable to test the flow"
createdAt: 2026-04-25T00:00:00Z
---

# T4-kid-flow — Kid Dashboard + Weekly Claim Flow

## §1 Back-reference

Part of epic [compound-learning-elementary](spike-plan.md). See [spike-plan §7](spike-plan.md#7-tickets) for sibling tickets and current status.

## §2 This Ticket's Role in the Big Picture

T4 는 **자녀가 직접 만지는 모든 흐름**을 한 ticket에 묶는다 — dashboard, 청구 의식, 자유→실험 이동, 30분 비활성 logout. 자녀의 "주간 의식 체험"이 epic의 핵심 학습 메커니즘이므로, 이 흐름이 한 PR에 묶여 일관된 UX/카피로 검증된다.

T4 가 머지되면:
- 자녀 코드로 로그인 시 dashboard에 잔액 3종 표시 (자유/실험/보너스)
- 일요일 19시 (또는 보호자가 설정한 deadline day) 가 되면 청구 가능 표시
- 산수 게임 → 정답 → 잔액 +10% 애니메이션
- 오답 5회 시 그 주 락 + carry-over (자녀에게 친절한 안내)
- 자유 → 실험 이동 시 slider + "1주 잠금" 명시

학습 메시지 무력화 위험을 막는 핵심 요소:
- 통제 카피 X ("해야 합니다" → "할 수 있어요")
- 자녀가 자유 영역을 마음껏 쓸 수 있다고 느끼게 (Success Criterion §1.2 "자유 영역 인식")
- 청구의 "의식" 가치 보존 — 단순 버튼 클릭이 아니라 산수 풀이 + 결과 애니메이션

## §3 Relevant API Contract Slice

### Server Actions (T1 placeholder 채움)

```typescript
// app/(kid)/dashboard/actions.ts
async function getCurrentMathProblem(input: {
  accountId: string;
}): Promise<
  | { problemId: string; question: string; choices?: string[]; attemptsRemaining: number }
  | null  // already claimed this week
>;

// app/(kid)/claim/actions.ts
async function attemptClaim(input: {
  accountId: string;
  weekNum: number;
  problemId: string;
  userAnswer: string;
}): Promise<
  | { ok: true; newExperimentBalance: number; growthThisWeek: number; pendingClaimsRemaining: number }
  | { ok: false; reason: 'wrong_answer' | 'already_claimed' | 'not_yet_unlockable' | 'attempts_exhausted' | 'expired_pending' | 'invalid_problem_id' }
>;

// app/(kid)/dashboard/transfer-actions.ts
async function transferFreeToExperiment(input: {
  accountId: string;
  amount: number;
}): Promise<
  | { ok: true; newFreeBalance: number; newExperimentBalance: number; lockUntilWeek: number }
  | { ok: false; reason: 'insufficient_balance' | 'invalid_amount' | 'cycle_ended' }
>;
```

### Server Action 내부 흐름 (단일 RPC)

```typescript
// attemptClaim 의사 코드
async function attemptClaim(input) {
  const requestId = crypto.randomUUID();
  await db.execute(`SET LOCAL app.request_id = '${requestId}'`);

  const result = await db.rpc('process_claim', {
    p_account_id: input.accountId,
    p_week_num: input.weekNum,
    p_problem_id: input.problemId,
    p_user_answer: input.userAnswer,
  });

  log.info({ request_id: requestId, action: 'attemptClaim', ...result });
  return result;
}
```

도메인 로직은 RPC 안에 있음 (Postgres function), but 같은 로직의 client-side preview는 `lib/domain/claim.ts` 사용 (예: 답 입력 중 잔액 미리보기 — 서버 호출 없음).

## §4 Relevant Migrations

T4 는 schema 안 건드림. T1 + T2 의 schema 사용만.

## §5 Relevant Observability Hooks

### Metrics (T4 owner)
- `claim.attempted_total` — `attemptClaim` 호출 시 +1
- `claim.succeeded_total` — `{ok:true}` 응답 시 +1
- `claim.duration_seconds` — Server Action 시작 → 응답 (histogram)
- `mathgen.failure_total` — `getCurrentMathProblem` throw 시 +1
- `brute_force_lockout_total` — `attempts_exhausted` 응답 시 +1
- `kid_session.timeout_total` — 30분 비활성 logout 시 +1

### Logs

`attemptClaim`:
```json
{
  "action": "attemptClaim",
  "actor_role": "kid",
  "family_id_hash": "...",
  "account_id": "...",
  "week_num": 3,
  "problem_id": "...",
  "answer_correct": true,
  "attempt_number_this_week": 1,
  "success": true,
  "growth_this_week": 1100
}
```

오답 시:
```json
{
  "action": "attemptClaim",
  "answer_correct": false,
  "attempt_number_this_week": 3,
  "error_code": "wrong_answer"
}
```

### Alerts
T4 자체에 새 alert 없음. 기존 alarm 조건들이 이 티켓의 metric에서 trigger됨.

## §6 Implementation Notes

<!-- BEGIN AUTO-GENERATED IMPL LOG -->
_(populated by /implement)_
<!-- END AUTO-GENERATED IMPL LOG -->

## §7 Discoveries / Reference-doc Corrections

_(empty until /implement runs)_

---

## Design Direction (User-confirmed)

**Hybrid: 일러스트 (B) + 그래프/카드 (A)**

자녀가 친근감을 느끼는 일러스트 메타포 + 정확성을 보여주는 카드/숫자.

### Visual Metaphor

| 영역 | 메타포 | 시각 |
|---|---|---|
| 자유 영역 | "내 지갑" | 지갑 일러스트, 잔액 숫자 큼지막하게 |
| 실험 영역 | "씨앗→새싹→나무" (시간 진행에 따라 성장) | 주차별 성장 단계 일러스트, 옆에 숫자 |
| 보너스 영역 | "보호자가 채워주는 우물" | 우물 일러스트, 채워지는 애니메이션 |

청구 후 애니메이션:
- 정답 시: 새싹이 한 단계 자라는 0.8s 애니메이션 + "+1100원" 카운터 업
- 오답 시: 부드러운 "다시 해보자!" 메시지 + 잔여 시도 횟수 (5/4/3/2/1)
- 5회 락 시: "이번 주는 다음 주에 다시 도전!" — 부정적 메시지 X

### Copy 가이드

- ❌ "이번 주 청구를 해야 합니다"
- ✅ "이번 주 이자를 받을 수 있어요 (+1100원)"
- ❌ "잘못된 답입니다"
- ✅ "조금 다르네요! 다시 해볼래요? (3번 더)"
- ❌ "잠금 해제 실패"
- ✅ "이번 주는 다음 주에 다시!"

자녀의 자율성 강조 (Success Criterion: "통제받지 않는다").

---

## Acceptance Criteria

### Unit Tests (UI 측)
- [ ] dashboard 컴포넌트: 잔액 3종 props로 받으면 정확히 표시
- [ ] claim form: 답안 input 디바운스 + 제출 후 disable
- [ ] 30분 비활성 timer: 마우스/키보드 활동 시 reset, 30분 후 logout

### Integration Tests
- [ ] `attemptClaim` (정답): 단일 transaction 안에 transactions INSERT + accounts UPDATE + claim_attempts INSERT + weekly_snapshots INSERT 모두 존재
- [ ] `attemptClaim` (오답): claim_attempts INSERT만, balance 변경 없음
- [ ] `attemptClaim` cross-family JWT (자녀가 다른 가족 accountId): graceful `{ok:false, reason:'invalid_problem_id'}` (RLS denied → 일관된 에러)
- [ ] `attemptClaim` 동일 weekNum 두 번 호출: 두 번째는 `{ok:false, reason:'already_claimed'}`, transactions 추가 INSERT 없음
- [ ] `transferFreeToExperiment` atomic, lock_until_week 정확

### E2E (Playwright + clock injection)
- [ ] **Golden path**: 자녀 코드 로그인 → dashboard 잔액 표시 (10000 free, 0 exp) → free→exp 이동 8000원 → clock 1주 진행 → 청구 화면 → 산수 정답 → 잔액 8800 표시
- [ ] **Brute-force lockout**: 자녀 5회 오답 → 5번째에 lockout 메시지 + 잔여 시도 0 → 그 주 청구 화면 락
- [ ] **Skip-and-catch (4주)**: clock 4주 진행 → 한 번 청구 → 4주분 누적 이자 +/잔액 갱신
- [ ] **Skip-and-catch (5주, expired)**: clock 5주 진행 → 청구 시 1주분 이자 영구 소멸 표시
- [ ] **30분 inactivity**: 자녀 화면에서 30분 비활성 → 자동 logout → 재로그인 코드 입력 페이지로

### A11Y (axe-core CI)
- [ ] 모든 인터랙티브 요소 키보드 도달 가능
- [ ] 산수 문제 텍스트 ≥ 16px, line-height ≥ 1.5
- [ ] 색약 시뮬레이션: 자유/실험/보너스가 색만이 아닌 아이콘으로도 구분
- [ ] 스크린 리더로 청구 흐름 완료 가능

### Korean Copy Review
- [ ] 모든 카피가 5-6학년 readable level (한자/외래어/추상어 최소)
- [ ] 통제 어조 0건 ("해야 합니다", "꼭", "반드시" 등)
- [ ] 친근/격려 어조 100% (자기보고 1인 대상으로 검증)

### Multi-agent Review
- [ ] 5명의 multi-agent review 통과

## Estimated Complexity

큼. T4는 epic에서 **자녀에게 노출되는 모든 UI**라 디테일이 많음. 가장 까다로운 부분:
- 일러스트 애니메이션 (CSS or Lottie?) — 의존성 결정 필요 (`/implement` Phase 2 research)
- 30분 inactivity client-side timer + server invalidate 동기화
- 정답 시 잔액 애니메이션의 카운터 (큰 수 이동을 부드럽게)
- E2E clock injection이 KST 기준 동작

T4 가 끝나면 자녀가 epic을 실제로 사용 가능 — minimum lovable product.
