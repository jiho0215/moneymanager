# ADR-006: Weekly Tick + KST Timezone

**Status**: Accepted
**Date**: 2026-04-25
**Deciders**: spike phase (architect identified gap in v1)
**Epic**: compound-learning-elementary

## Context

이 시스템의 핵심 단위는 **"주(week)"**. 주 단위로:
- 청구 가능한 이자가 unlock
- 산수 시도 횟수 카운트 (5회 lockout)
- pending interest 누적/expire
- 주간 snapshot 기록

따라서 **"몇 주차인가? 언제 새 주가 시작되는가?"** 가 모든 기능의 토대다. v1 에서 이 정의가 누락되어 다음 모호성 발생:

- 자녀가 일요일 23:58 KST에 청구 vs 월요일 00:02 KST에 청구 — 같은 주? 다른 주?
- DB는 UTC 저장. 월요일 00:00 KST = 일요일 15:00 UTC. 어느 시간 기준?
- DST? (한국은 없지만 글로벌 사용자 가능성)

## Decision

### 1. KST 하드코딩

- 시간대: **UTC+9 (KST), 하드코딩**
- 한국은 DST 없음. DB의 `AT TIME ZONE 'Asia/Seoul'` 또는 동등한 변환 함수 사용
- 글로벌 확장 시 user-level timezone 컬럼 추가 (post-MVP)

### 2. 주 경계

- **월요일 00:00 KST 부터 일요일 23:59 KST 까지가 한 주**
- 월요일 00:00 KST = 일요일 15:00 UTC

### 3. Week Number 공식

```
week_num = floor((now_kst - account.epoch_kst) / 7 days)
```

여기서:
- `now_kst` = `now() AT TIME ZONE 'Asia/Seoul'`
- `account.epoch_kst` = 가족 생성 직후 첫 월요일 00:00 KST

### 4. Epoch 정렬

가족 생성 시점 → 다음 월요일 00:00 KST 로 epoch 설정.

```sql
-- create_family_with_kid RPC 안에서
INSERT INTO accounts (..., epoch_kst, ...) VALUES (
  ...,
  date_trunc('week', now() AT TIME ZONE 'Asia/Seoul') + interval '7 days',  -- 다음 월요일 00:00 KST
  ...
);
```

이로써 모든 자녀의 첫 주는 정확히 7일이고, 일요일 22시 의식이 첫 주에 가능.

### 5. 서버 시간이 권위

- 클라이언트 시간 신뢰 X (조작 가능)
- 모든 week_num 계산은 Postgres `now()` 기준
- 자녀가 "내 시계로는 여전히 일요일이에요" 주장 → 서버가 거부 (학습 일부)

## Consequences

### Pros
- 결정적, 모호성 없음
- DST 버그 차단 (한국 한정 design)
- 서버 권위 = 부정행위 방지
- "주(week)" 가 cron, alarm, snapshot 등 모든 시스템과 동기

### Cons
- 글로벌 확장 시 추가 작업 (post-MVP)
- 자녀가 "제 휴가가 일요일에 끝나는데..." 같은 코너 케이스 → 의식의 가치 (시간이 권위) 일부

## Implementation

### `lib/domain/`

도메인 함수들은 **week_num 을 인자로 받음**. 시간/timezone 변환은 인프라 책임:

```typescript
// lib/domain/claim.ts
export function canClaim(
  account: ExperimentAccount,
  currentWeekNum: number,  // ← 인자 주입, 도메인은 시간 모름
): boolean { /* ... */ }
```

### `lib/db/`

DB-side 헬퍼:

```typescript
// lib/db/time.ts
export async function getCurrentWeekNum(accountId: string): Promise<number> {
  const { data } = await supabase.rpc('compute_week_num', { account_id: accountId });
  return data;
}
```

### Postgres function

```sql
CREATE OR REPLACE FUNCTION compute_week_num(account_id UUID)
RETURNS INTEGER AS $$
DECLARE
  account_epoch TIMESTAMPTZ;
  now_kst TIMESTAMPTZ;
BEGIN
  SELECT epoch_kst INTO account_epoch FROM accounts WHERE id = account_id;
  now_kst := now() AT TIME ZONE 'Asia/Seoul';
  RETURN floor(extract(epoch from (now_kst - account_epoch)) / (7 * 86400))::INTEGER;
END;
$$ LANGUAGE plpgsql STABLE;
```

## Test Implications

- Boundary test: 일요일 23:59 vs 월요일 00:01 → 다른 week_num
- Epoch alignment: 가족 생성 in 화요일 → epoch is 다음 월요일 (정확히 6일 후)
- DST simulation: (한국 무관이므로 skip; 글로벌 확장 시 필요)
- Clock injection (Playwright): `page.clock.setFixedTime` 가 KST 기준으로 동작 검증

## Alternatives Considered

- **UTC anchor**: rejected. 일요일 19시 KST = 토요일 10시 UTC. weekend 의 의미 깨짐.
- **User-level timezone**: rejected for MVP. Korean users only. post-MVP에 추가 가능 (schema에 `users.timezone TEXT DEFAULT 'Asia/Seoul'`).
- **Rolling 7-day window from claim**: rejected. "주 = 한 번의 의식" 메타포 깨짐. 청구 시점이 매번 달라지면 가족 의식 시간 (일요일 19시) 무력화.
