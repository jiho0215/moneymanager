# ADR-004: RLS as Primary Permission

**Status**: Accepted
**Date**: 2026-04-25
**Deciders**: spike phase (multi-agent reviewed)
**Epic**: compound-learning-elementary

## Context

권한 모델:
- 자녀(kid)는 **자기 가족 데이터만** read 가능, **자기 청구 시도만** write 가능
- 보호자(guardian)는 **자기 가족 전체** read, 설정 write 가능
- 외부 사용자는 어떤 row도 못 봄

전통적 접근 (모든 query 코드에 `if user.role === 'guardian'` 체크)는:
- 코드 어딘가에 빼먹으면 정보 누출
- 새 query 추가 시 권한 체크 잊기 쉬움
- 코드 버그 = 보안 버그

PostgreSQL Row Level Security (RLS)는:
- DB가 모든 query에 자동으로 권한 정책 적용
- 코드가 어떻든 DB가 거부
- "default deny"

## Decision

**모든 테이블에 RLS enable. 코드 레벨 권한 체크는 UX (에러 메시지) 일 뿐, 보안 보증은 DB.**

### RLS JOIN Path

```
auth.uid()  →  memberships.user_id
            →  memberships.family_id
            →  accounts.membership_id (혹은 family_id 직접)
            →  transactions.account_id
            →  claim_attempts.account_id
            →  weekly_snapshots.account_id
```

모든 정책은 이 JOIN을 따라 `family_id` 일치 확인.

### Role 분리

| Role | 사용처 | 권한 |
|---|---|---|
| `service_role` | migration/admin 전용 | 모든 권한 (RLS bypass) |
| `app_writer` | Server Actions (`SUPABASE_APP_DB_URL`) | RLS 적용 + transactions INSERT만 (ADR-005) |
| `anon` | 미인증 사용자 | 거의 모든 거부 (auth 페이지 외) |

`service_role` 키는 **Server Action 코드에서 직접 사용 금지**. 마이그레이션 스크립트만 사용. Server Actions은 user JWT 기반의 `supabase.createClient()` 또는 `app_writer` 키로 connect.

## Consequences

### Pros
- 코드 버그가 있어도 데이터 안전
- 새 query 추가 시 권한 자동 적용
- audit trail 명확 (RLS denied 로그)
- 정책이 SQL로 명시적

### Cons
- RLS 정책 SQL 작성/디버깅 학습 곡선
- 모든 query에 RLS evaluation overhead (현실 무시할 수준)
- `service_role` 키 관리 주의 (실수로 Server Action에서 사용하면 RLS bypass)
- 테스트 셋업 복잡: 다른 사용자 JWT로 simulate해야 RLS 검증 가능

## Implementation (T1)

### 정책 예시 (전체는 migration 008)

```sql
-- enable RLS
ALTER TABLE families ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE claim_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE consents ENABLE ROW LEVEL SECURITY;

-- families: 가족원만 자기 가족 SELECT
CREATE POLICY families_select ON families FOR SELECT USING (
  id IN (SELECT family_id FROM memberships WHERE user_id = auth.uid())
);

-- transactions: 같은 가족의 account만 SELECT
CREATE POLICY transactions_select ON transactions FOR SELECT USING (
  account_id IN (
    SELECT a.id FROM accounts a
    JOIN memberships m ON a.membership_id = m.id
    WHERE m.family_id = (SELECT family_id FROM memberships WHERE user_id = auth.uid())
  )
);

-- transactions: app_writer만 INSERT (UPDATE/DELETE는 ADR-005 trigger)
CREATE POLICY transactions_insert ON transactions FOR INSERT WITH CHECK (true);
-- (ADR-005에서 BEFORE UPDATE/DELETE 차단)
```

### Lint Rule (domain-no-io 와 별개)

ESLint custom rule `no-service-role`: Server Actions 코드에서 `process.env.SUPABASE_SERVICE_ROLE_KEY` 사용 시 error.

## Test Implications (§8.3.2 RLS — 3개 항목)

- Cross-family read attempt → 0 rows (모든 테이블)
- `app_writer` UPDATE/DELETE → `42501` (ADR-005 trigger)
- service_role 키 import → lint fail

## Alternatives Considered

- **App-level only**: rejected. 코드 버그 = 보안 버그.
- **App + RLS (defense in depth)**: 채택. 코드는 UX 가드, RLS는 보안 보증.
- **API gateway with policy engine**: rejected. overkill at this scale, Vercel + Supabase에 내장된 도구로 충분.
