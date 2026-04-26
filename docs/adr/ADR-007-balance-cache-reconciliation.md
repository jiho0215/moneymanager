# ADR-007: Balance Cache Reconciliation — Claim-Time Atomic Write

**Status**: Accepted
**Date**: 2026-04-25
**Deciders**: spike phase (architect + performance reviewer flagged in v1)
**Epic**: compound-learning-elementary

## Context

Schema 설계 (§6):
- `transactions` = append-only ledger (진실의 원천, ADR-005)
- `accounts.{free,experiment,bonus}_balance` = **cached balance** (조회 효율을 위함)
- `weekly_snapshots` = 주간 스냅샷 (그래프용)

문제: cache (잔액 컬럼) 과 ledger (transactions sum) 가 drift 가능. 가능한 원인:
- 코드 버그로 transactions 만 INSERT하고 accounts 갱신 누락
- 트랜잭션 중간 crash
- DB 레벨 부분 적용 (사실 거의 불가능하지만 design assumption으로)

drift 발생 시:
- 자녀 화면 잔액 ≠ 실제 (transactions sum)
- 보호자 화면도 마찬가지
- 학습 메시지 (시간 = 돈) 무력화

## Decision

**3겹 보장:**

### 1. 단일 Postgres RPC: `process_claim`

모든 잔액 변화는 **단일 Postgres function 안에서 단일 transaction으로** 수행. Server Action은 이 RPC만 호출.

```sql
CREATE OR REPLACE FUNCTION process_claim(
  p_account_id UUID,
  p_week_num INT,
  p_problem_id UUID,
  p_user_answer TEXT
) RETURNS JSONB AS $$
DECLARE
  -- ...
BEGIN
  -- 1. validate (week, lockout, problem_id replay 등)
  -- 2. INSERT INTO claim_attempts (...) -- 항상 (성공/실패 무관)
  -- 3. IF correct THEN
  --      INSERT INTO transactions (...) -- interest_accrued + interest_claimed
  --      UPDATE accounts SET experiment_balance = ..., pending_interest = ... WHERE id = ...
  --      INSERT INTO weekly_snapshots (...)
  --    END IF
  -- 모두 같은 BEGIN...COMMIT 블록
  RETURN jsonb_build_object('ok', ..., 'newBalance', ...);
END;
$$ LANGUAGE plpgsql;
```

이로써 cache + ledger + snapshot 이 **항상 함께 갱신** 또는 **함께 미갱신**. drift 불가능.

### 2. Reconciler: `reconcile_balance(account_id)`

월간 cron (Vercel Cron `0 0 1 * *`) 으로 점검:

```sql
CREATE OR REPLACE FUNCTION reconcile_balance(p_account_id UUID)
RETURNS JSONB AS $$
DECLARE
  computed_balance BIGINT;
  cached_balance BIGINT;
BEGIN
  -- experiment zone 예시
  SELECT
    COALESCE(SUM(CASE
      WHEN zone = 'experiment' THEN amount
      ELSE 0
    END), 0)
  INTO computed_balance
  FROM transactions
  WHERE account_id = p_account_id;

  SELECT experiment_balance INTO cached_balance
  FROM accounts
  WHERE id = p_account_id;

  IF computed_balance != cached_balance THEN
    -- log + alarm
    RETURN jsonb_build_object('drift', true, 'computed', computed_balance, 'cached', cached_balance);
  END IF;

  RETURN jsonb_build_object('drift', false);
END;
$$ LANGUAGE plpgsql;
```

drift 발견 시:
- 즉시 alarm (Resend 이메일)
- 자동 복구 안 함 (수동 검토 필수 — 원인 파악이 더 중요)

### 3. Trust the Ledger

drift 가 발견되면 **transactions sum 이 정답**. cache 는 무시하고 ledger 기준으로 재계산:

```sql
UPDATE accounts
SET experiment_balance = (
  SELECT COALESCE(SUM(amount), 0) FROM transactions
  WHERE account_id = accounts.id AND zone = 'experiment'
)
WHERE id = '<drift-detected-account>';
```

수동/관리자 액션, RPC `recompute_balance(account_id)` 형태로 보존.

## Consequences

### Pros
- Atomic — drift 가능성이 거의 0
- 그래도 drift 발견 시 자동 감지 (월간 reconciler)
- ledger 가 진실 — 어떤 cache 손상도 복구 가능
- single round-trip — performance reviewer 우려 해소 (multi-roundtrip 제거)

### Cons
- 모든 잔액 변화가 RPC 통과 — Server Action 코드 단순화 BUT RPC 작성 부담
- reconciler RPC 추가 cost (월 1회, negligible)
- 자동 복구 안 함 — drift 시 수동 검토 (의도된 cost)

## Alternatives Considered

- **Materialized view**: rejected. refresh cost + 일관성 윈도우.
- **View only (no cache)**: rejected. 모든 SELECT가 SUM(transactions) 계산 → guardian dashboard 에서 N+1.
- **Async reconciler (every claim)**: rejected. 청구 응답 시간↑.
- **Trigger that recomputes balance on each transactions INSERT**: rejected. RPC 안에서 명시적으로 하는 게 더 명확 + 디버깅 용이.

## Test Implications (§8.5)

- `process_claim` 정상: transactions row INSERT + accounts.experiment_balance 갱신 + weekly_snapshots row INSERT 모두 1 transaction 안에 존재
- `process_claim` rollback (오답): claim_attempts row INSERT 만 됨. accounts/transactions/snapshots 미변경.
- Drift simulation: 직접 SQL로 transactions row 삭제 (test DB) → reconciler 가 drift 감지
- Recompute: drift account 에 `recompute_balance` 호출 → cache 가 ledger 일치하게 복원

## Files

- `supabase/migrations/010_rpc_definitions.sql`: `process_claim`, `create_family_with_kid`, `reconcile_balance`, `recompute_balance`
- `app/api/cron/monthly-reconcile/route.ts`: 월간 reconciler caller
