# ADR-003: Domain Purity with Typed Boundary

**Status**: Accepted
**Date**: 2026-04-25
**Deciders**: spike phase (multi-agent reviewed; architect flagged must-fix)
**Epic**: compound-learning-elementary

## Context

`lib/domain/` 의 함수들 (`compound`, `claim`, `mathgen`, `zones`)은:
- 단위 테스트가 인프라 없이 가능해야 함 (DB 없이, Vercel 없이)
- 결정적 (시간/random 인자 주입)
- 향후 다른 프레임워크 (SvelteKit, Remix, RN) 로 옮겨도 그대로 재사용

문제: TypeScript 환경에서 단순히 "import 안 한다"는 컨벤션은 약하다. 누군가 `Database['public']['Tables']['accounts']['Row']` 같은 Supabase 자동생성 타입을 도메인 함수에 넘기면, 타입은 컴파일되지만 도메인이 Supabase 종속이 된다. 향후 schema 변경 시 도메인 코드도 깨지는 fragile coupling.

## Decision

세 겹의 강제 메커니즘으로 도메인 순수성을 보장:

### 1. `lib/domain/types.ts` 가 단일 진리

도메인이 받는 모든 입력/출력은 plain TypeScript value type. Supabase 타입 import 금지.

```typescript
// lib/domain/types.ts
export type ExperimentAccount = {
  id: string;
  experimentBalance: number;
  pendingInterest: number;
  weeklyGrowthRateBp: number;
  cycleNumber: number;
  weekNumStarted: number;
  // NO Supabase Row type, NO Date object (use ISO string or number ms)
};

export type ClaimResult =
  | { ok: true; newBalance: number; growthThisWeek: number; pendingClaimsRemaining: number }
  | { ok: false; reason: 'wrong_answer' | 'already_claimed' | /* ... */ };
```

### 2. `lib/db/mappers.ts` 가 경계

DB Row ↔ domain value type 변환 전담. 도메인은 DB 모름.

```typescript
// lib/db/mappers.ts
import type { Database } from '@/lib/db/types';
import type { ExperimentAccount } from '@/lib/domain/types';

export function toExperimentAccount(
  row: Database['public']['Tables']['accounts']['Row']
): ExperimentAccount { /* ... */ }
```

### 3. ESLint custom rule `domain-no-io`

`lib/domain/**` 에서 다음 import 금지:
- `@supabase/*`, `@/lib/db/*`
- `next/*`, `react`, `react-dom`
- `fs`, `path`, `crypto` (random은 인자로)
- `Date` 직접 호출 (시간 인자로 받음)

위반 시 `pre-commit` hook으로 reject.

## Consequences

### Pros
- 단위 테스트가 진짜 단위 — 인프라 모킹 불필요
- 향후 프레임워크 이동 가능
- 타입 변경의 영향 범위가 작음 (mapper만 수정)
- 도메인 함수는 readable한 비즈니스 로직만 남음

### Cons
- 매퍼 코드 추가 (한 번 작성, 거의 안 변함)
- Supabase Row와 domain value type 둘 사이의 변환 비용 (negligible at scale)

## Alternatives Considered

- **Pass DB Rows directly to domain**: rejected. fragile coupling, schema 변경마다 도메인 깨짐.
- **Single shared "Account" type**: rejected. DB row와 domain value의 관심사가 다름 (예: domain은 `epoch_kst` 같은 raw column 안 받음, 이미 derived `weekNumStarted` 받음).
- **Comment-only convention**: rejected. 강제력 없음. 새 사람 들어오면 깨짐.

## Test Implications

- `lib/domain/**` 단위 테스트는 `@supabase/*` import 0개여야 함 — CI에서 검증
- 매퍼는 별도 unit test (`tests/db/mappers.test.ts`)
- 도메인 로직 변경 시 mapper 수정 불필요 (decoupled)

## Files Affected

- `lib/domain/types.ts` — 신규
- `lib/domain/{compound,claim,mathgen,zones}.ts` — 인풋/아웃풋이 types.ts 만 사용
- `lib/db/mappers.ts` — 신규
- `eslint.config.js` — `domain-no-io` rule 추가
