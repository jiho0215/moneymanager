# ADR-005: Append-Only Transactions, Defense in Depth

**Status**: Accepted
**Date**: 2026-04-25
**Deciders**: spike phase (multi-agent reviewed; architect flagged must-fix on service_role bypass)
**Epic**: compound-learning-elementary

## Context

`transactions` 테이블은 **모든 잔액 변화의 진실의 원천 (source of truth)**. 잔액 컬럼 (`accounts.experiment_balance` 등)은 캐시일 뿐 (ADR-007).

따라서:
- transactions 가 변조되면 잔액 복원 불가능
- 자녀가 부모 계정 access 했다고 가정해도 transactions 못 지우게 해야 audit 가능
- 코드 버그로 UPDATE/DELETE 가 transactions 에 가도 거부되어야 함

Supabase의 `service_role` 키는 Postgres superuser. RLS도 GRANT도 bypass. 만약 Server Action이 service_role 키로 connect하면 단순 GRANT만으로는 보호 부족.

## Decision

**3중 방어:**

### 1. DB Role 분리

```sql
-- migration 009
CREATE ROLE app_writer LOGIN PASSWORD '...';

GRANT USAGE ON SCHEMA public TO app_writer;
GRANT SELECT, INSERT ON families, memberships, accounts, claim_attempts, consents TO app_writer;
GRANT SELECT, INSERT, UPDATE ON accounts TO app_writer;  -- balance cache 갱신 위해
GRANT SELECT, INSERT ON transactions TO app_writer;
REVOKE UPDATE, DELETE ON transactions FROM app_writer;  -- 명시적 거부
GRANT SELECT, INSERT ON weekly_snapshots TO app_writer;
GRANT EXECUTE ON FUNCTION process_claim, create_family_with_kid, reconcile_balance TO app_writer;
```

Server Actions은 `SUPABASE_APP_DB_URL` 환경변수 (app_writer credentials) 로 connect.

### 2. Postgres Trigger (이중 보호)

```sql
CREATE OR REPLACE FUNCTION transactions_immutable()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'transactions is append-only (ADR-005). Use reverses_transaction_id for corrections.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transactions_no_update_or_delete
BEFORE UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION transactions_immutable();
```

심지어 `service_role` 권한자(superuser)도 trigger는 우회 못함 (BYPASSRLS 와 trigger는 별개).

### 3. Reversal Pattern

값 정정/취소가 필요하면 **새 row INSERT**:

```sql
INSERT INTO transactions (account_id, transaction_type, amount, reverses_transaction_id, ...)
VALUES (
  '<account>',
  'bonus_match_revert',
  -1000,
  '<original_tx_id>',
  ...
);
```

`reverses_transaction_id` 컬럼 (ADR-005 schema 일부) 가 audit trail 명시.

## Consequences

### Pros
- 코드/사람 실수로 audit 손상 불가능
- Insider threat 방어 (service_role 키 유출 시에도 trigger 보호)
- audit reconstruction 항상 가능: 모든 변화는 row로 남음
- reversal도 명시적 (어떤 tx를 cancel하는지 link)

### Cons
- 단순 "오타 수정" 도 새 row INSERT 필요 (의도된 cost)
- transactions 행 수 증가 (단, MVP 기준 8주 × ~5tx = 40 rows. negligible)
- trigger overhead (per-row): per INSERT 0 cost, per UPDATE/DELETE 즉시 throw (사실상 0)

## Implementation Files

- `supabase/migrations/009_app_writer_role.sql` (UP) + `009_app_writer_role.down.sql` (DOWN)
- `supabase/migrations/010_transactions_trigger.sql` (UP) + DOWN
- `lib/db/index.ts`: `createServerClient()` 가 `SUPABASE_APP_DB_URL` 사용
- ESLint rule `no-service-role`: `lib/db/**` 외부에서 `SUPABASE_SERVICE_ROLE_KEY` 사용 시 error

## Test Implications (§8.3.2 RLS)

- `app_writer` 로 `UPDATE transactions SET amount=999 WHERE id=<any>` → trigger exception
- `app_writer` 로 `DELETE FROM transactions WHERE id=<any>` → trigger exception
- service_role 키 사용한 Server Action 코드 → lint fail (CI block)
- reversal: `bonus_match` INSERT 후 `bonus_match_revert` INSERT, `reverses_transaction_id` 일치 확인

## Alternatives Considered

- **Trigger only (no role)**: rejected. 정상 사용에서도 의도치 않은 UPDATE 가능 (RLS 정책으로는 잡히지 않음).
- **Role only (no trigger)**: rejected. service_role 키로 bypass 가능.
- **Append-only via app code**: rejected. 코드 버그 = 데이터 손상. DB 강제가 안전.
- **Time-based audit table (separate)**: rejected. 잔액 = SUM(transactions) invariant 깨짐. transactions 자체가 audit여야 함.
