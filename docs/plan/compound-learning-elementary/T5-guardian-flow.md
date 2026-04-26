---
epicId: compound-learning-elementary
ticketId: T5-guardian-flow
status: planned
implBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "needs schema, RLS, RPC"
  - ticketId: T2-auth-family
    kind: hard
    reason: "needs guardian session + kid login code generation"
  - ticketId: T3-domain
    kind: soft
    reason: "settings copy uses domain function previews; can fall back to static copy"
deployBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "T1's deployed schema + RPC required"
  - ticketId: T2-auth-family
    kind: hard
    reason: "guardian must be able to log in to test the flow"
createdAt: 2026-04-25T00:00:00Z
---

# T5-guardian-flow — Guardian Dashboard + Audit + Settings + Cycle Mgmt

## §1 Back-reference

Part of epic [compound-learning-elementary](spike-plan.md). See [spike-plan §7](spike-plan.md#7-tickets) for sibling tickets and current status.

## §2 This Ticket's Role in the Big Picture

T5 는 **보호자가 보는 모든 화면**을 한 ticket에 묶는다 — dashboard, audit, settings, kid login code 발급, 8주 사이클 종료 처리, 추가 입금. 자녀가 사용하는 흐름 (T4) 과 병렬 작업 가능 — 다른 라우트 그룹, 다른 권한.

T5 가 머지되면:
- 보호자가 자녀의 모든 활동 (잔액, 청구 시도, transactions) 한 화면에서 확인
- 매칭 비율, 청구일 등 가족별 settings 변경 가능 (의미는 명확화: 변경 시점부터 미래만 적용)
- 추가 deposit 으로 자녀의 자유/실험 영역에 입금 가능
- 8주 완주 시 reset/extend/graduate 선택
- PIPA consent evidence export (법적 의무)
- 자녀 로그인 코드 발급 (T2의 RPC 호출, UI는 T5)

학습 메시지 보존 핵심:
- 매칭 비율 변경 시 retroactive 변경 안됨 (이미 매칭된 보너스는 그 시점 rate 유지 — 회계 원칙 + ADR-005 append-only)
- 추가 입금은 transactions row INSERT 로 audit (어떤 amount가 언제 들어왔는지 자녀에게도 투명)

## §3 Relevant API Contract Slice

### Server Actions

```typescript
// app/(guardian)/settings/actions.ts
async function updateAccountSettings(input: {
  accountId: string;
  weeklyGrowthRateBp?: number;       // 변경 시: 다음 청구부터 새 rate 적용 (전 사이클은 그대로)
  bonusMatchRateBp?: number;         // 변경 시: 미래 매칭에만 적용 (retroactive 변경 X)
  weeklyDeadlineDayOfWeek?: 0|1|2|3|4|5|6;
}): Promise<{ ok: boolean; reason?: 'unauthorized' | 'invalid_input' }>;

// app/(guardian)/dashboard/actions.ts (NEW)
async function depositAdditional(input: {
  accountId: string;
  amount: number;                    // KRW BIGINT, 양수만
  zone: 'free' | 'experiment';
}): Promise<
  | { ok: true; newFreeBalance: number; newExperimentBalance: number; newBonusBalance: number }
  | { ok: false; reason: 'invalid_amount' | 'unauthorized' | 'cycle_ended' }
>;
// 'experiment' 입금 시: 매칭 비율에 따라 보너스 영역도 함께 INSERT
// transactions row 2~3개 (deposit + optional bonus_match)

// app/(guardian)/end-of-cycle/actions.ts
async function chooseCycleEndAction(input: {
  accountId: string;
  cycleNumber: number;
  action: 'reset' | 'extend' | 'graduate';
  newStartingCapital?: number;       // 'reset' 시 필수
}): Promise<{ ok: boolean }>;
// reset: 새 사이클 시작 (cycle_number+1, balance 새 시작 자금으로 초기화, 단 transactions 는 보존)
// extend: 현 사이클 그대로 계속 (8주 너머)
// graduate: 잔액 동결 (이자 더 안 자람), 자녀 화면에 "졸업" 메시지

// app/(guardian)/audit/actions.ts
async function exportConsentEvidence(input: {
  familyId: string;
}): Promise<{ ok: true; csvContent: string } | { ok: false; reason: string }>;
// PIPA consent table → CSV download
// fields: timestamp, consent_text, consent_version, accepted_by_user_id, family_id
```

### `depositAdditional` 의 atomic 흐름 (`process_deposit` RPC, NEW)

```sql
-- migration 추가 후보 (T5 owner)
CREATE FUNCTION process_deposit(
  p_account_id UUID,
  p_amount BIGINT,
  p_zone TEXT  -- 'free' | 'experiment'
) RETURNS JSONB AS $$
BEGIN
  -- 1. INSERT transactions (transaction_type='manual_adjustment', amount=p_amount, zone=p_zone)
  -- 2. UPDATE accounts SET {free_balance|experiment_balance} += p_amount
  -- 3. IF p_zone = 'experiment' AND bonus_match_rate_bp > 0 THEN
  --      bonus_amount = floor(p_amount * bonus_match_rate_bp / 10000)
  --      INSERT transactions (transaction_type='bonus_match', amount=bonus_amount, zone='bonus')
  --      UPDATE accounts SET bonus_balance += bonus_amount
  --    END IF
  -- atomic transaction
  RETURN jsonb_build_object(...);
END;
$$ LANGUAGE plpgsql;
```

## §4 Relevant Migrations

T5 owner:

| # | 변경 | 비고 |
|---|---|---|
| 013 | `process_deposit` RPC 추가 (위 시그니처) | T5 owner |

기존 schema 변경 없음. T1, T2 의 schema 사용.

## §5 Relevant Observability Hooks

### Metrics (T5 owner)
- `guardian.settings_changed_total` — labels: `field` (rate/match/dow)
- `guardian.deposit_total` — counter, sum amount는 별도 metric
- `guardian.deposit_amount_krw` — gauge (per family, 누적)
- `cycle.ended_total` — labels: `action` (reset/extend/graduate)
- `consent.exported_total` — PIPA evidence export

### Logs

`updateAccountSettings`:
```json
{
  "action": "updateAccountSettings",
  "actor_role": "guardian",
  "field": "bonus_match_rate_bp",
  "old_value": 2000,
  "new_value": 2500,
  "applies_from": "future_matches_only"
}
```

매칭 비율 변경은 **명시적 로그**로 retroactive 미적용을 audit.

`depositAdditional`:
```json
{
  "action": "depositAdditional",
  "actor_role": "guardian",
  "amount": 5000,
  "zone": "experiment",
  "bonus_matched": 1000,
  "bonus_match_rate_bp_at_time": 2000
}
```

### Alerts (T5 owner)
- `cycle.ended_total{action='reset'}` 빈번 발생 (예: > 1/주) → 자녀 의도적 abuse 가능성, 정보용 alarm

## §6 Implementation Notes

<!-- BEGIN AUTO-GENERATED IMPL LOG -->
_(populated by /implement)_
<!-- END AUTO-GENERATED IMPL LOG -->

## §7 Discoveries / Reference-doc Corrections

_(empty until /implement runs)_

---

## Settings Semantics (User-confirmed)

### 시작 자금 (`startingCapital`)
- **가족 생성 시**: 즉시 적용 (T2의 `createFamily` 안)
- **사이클 중간**: settings에서는 **변경 불가**. 대신 `depositAdditional` 로 입금.
- **다음 사이클 (reset)**: `chooseCycleEndAction(action='reset', newStartingCapital=...)` 로 새 시작 자금 설정

### 매칭 비율 (`bonusMatchRateBp`)
- **가족 생성 시**: 즉시 적용 (T2)
- **사이클 중간 변경**: 가능. 하지만 **변경 시점 이후 매칭만** 새 비율 적용 (retroactive 변경 X)
- 이미 보너스 영역에 들어있는 금액은 변경 영향 없음 — append-only audit 정합

### 청구일 (`weeklyDeadlineDayOfWeek`)
- **사이클 중간 변경**: 가능, 다음 주부터 적용

### 사이클 종료 액션 (Week 8+)
- `reset`: 잔액 0으로, cycle_number +1, 새 시작 자금 적용. 과거 transactions 보존 (학습 메시지: 자녀가 다음 사이클에서 "지난 번에는..." 회상 가능)
- `extend`: 8주 너머 계속. cycle_number 그대로
- `graduate`: 이자 적용 중단 (`cycle_status='graduated'`), 잔액은 그대로 보존, 자녀 화면 "졸업" 메시지

---

## Acceptance Criteria

### Integration Tests
- [ ] 보호자 JWT로 `updateAccountSettings(bonusMatchRateBp=2500)` → DB 반영, 기존 보너스 row들 변경 없음 (audit)
- [ ] 자녀 JWT로 `updateAccountSettings` 시도 → RLS 거부 (graceful 403, not 500)
- [ ] `depositAdditional(amount=5000, zone='experiment')`: transactions row 2개 (deposit + bonus_match), accounts UPDATE atomic. Bonus 적용 비율은 호출 시점 rate.
- [ ] `depositAdditional` (음수): graceful `{ok:false, reason:'invalid_amount'}`
- [ ] `chooseCycleEndAction(action='reset', newStartingCapital=20000)`: cycle_number +1, balance 초기화, 과거 transactions 보존, 새 시작 자금에 대한 initial_deposit transactions row 2개 (free 80%, exp 20%)
- [ ] `chooseCycleEndAction(action='graduate')`: `cycle_status='graduated'`, 이후 청구 시 `{ok:false, reason:'cycle_ended'}`
- [ ] `exportConsentEvidence`: CSV 형식, 모든 필드 포함, 다른 가족 데이터 미포함 (RLS 강제)

### E2E (Playwright)
- [ ] 보호자 로그인 → dashboard에 자녀 잔액 + 최근 활동 표시
- [ ] settings 변경 (매칭 비율 20%→25%) → 변경 후 추가 입금 시 25% 매칭 적용
- [ ] 8주 진행 (clock injection) → end-of-cycle 화면 자동 표시 → "reset" 선택 → cycle 2 시작 화면

### A11Y
- [ ] axe-core CI 통과
- [ ] 보호자는 어른 대상이므로 학년별 카피 가이드는 적용 안 함 (정보 밀도 OK)

### Multi-agent Review
- [ ] 5명의 multi-agent review 통과

## Estimated Complexity

중간. T1-T4 위에 얹힘. 가장 까다로운 부분:
- 매칭 비율 변경의 "retroactive 미적용" UX 명확화 (보호자에게 confirm dialog)
- `chooseCycleEndAction(reset)` 의 transactions 보존 + 잔액 초기화 — 과거 transactions row를 안 지우면서 새 cycle initial_deposit row 추가하는 방식
- consent CSV export 형식 (PIPA 감독원 요청 시 제출 가능 수준)
