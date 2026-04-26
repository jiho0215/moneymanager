# Compound Learning System

가족용 복리 학습 웹앱. 초등 5-6학년 자녀가 7-8주 안에 잔액이 2배가 되는 경험을 통해 **"시간이 돈을 키운다 (복리)"** 와 **"청구해야 받는다 (자본주의의 작동)"** 두 핵심 개념을 체험합니다.

## 현재 상태

- 📐 **Spike completed** (2026-04-25) — design + 6 tickets + 7 ADRs
- 🚧 **T1-foundation in progress** — Next.js skeleton + schema + RLS + cron infra

## Setup (개발자용)

### 1. Dependencies

```bash
npm install
```

### 2. Supabase 프로젝트 생성

1. [supabase.com](https://supabase.com) → "New Project"
2. **Region: Northeast Asia (Tokyo, ap-northeast-1)** (ADR-001)
3. Project name: `moneymanager-dev` (또는 `-prod`)
4. DB password 저장
5. Project Settings → API → URL과 anon key 복사

### 3. Environment variables

`.env.local` 생성 (`.env.example` 참조):

```bash
cp .env.example .env.local
# 그 후 .env.local에 실제 값 채움
```

### 4. Migrations 실행

Supabase CLI 설치:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>
supabase db push
```

또는 Supabase 대시보드 SQL Editor 에서 `supabase/migrations/` 의 SQL 파일을 순서대로 실행.

### 5. App writer role 생성 (Production)

ADR-005 에 따라 별도 `app_writer` role 필요. Supabase 대시보드 → Database → Roles → New role:

- Name: `app_writer`
- Set password
- 그 후 SQL Editor 에서:

```sql
GRANT USAGE ON SCHEMA public TO app_writer;
GRANT SELECT, INSERT ON families, memberships, consents, claim_attempts TO app_writer;
GRANT SELECT, INSERT, UPDATE ON accounts TO app_writer;
GRANT SELECT, INSERT ON transactions TO app_writer;
REVOKE UPDATE, DELETE ON transactions FROM app_writer;
GRANT SELECT, INSERT ON weekly_snapshots TO app_writer;
GRANT EXECUTE ON FUNCTION compute_week_num, reconcile_balance, recompute_balance TO app_writer;
```

connection string을 `SUPABASE_APP_DB_URL` 에 넣음.

### 6. Dev server

```bash
npm run dev
```

http://localhost:3000

## Scripts

| Command | 설명 |
|---|---|
| `npm run dev` | Dev server (Next.js) |
| `npm run build` | Production build |
| `npm run lint` | ESLint (포함: `domain-no-io` custom rule, ADR-003) |
| `npm run typecheck` | TypeScript 검증 |
| `npm test` | Vitest 단위 테스트 |
| `npm run test:coverage` | Coverage 리포트 (lib/domain ≥ 90% 강제) |

## Documentation

### Plan

| 파일 | 내용 |
|---|---|
| [docs/plan/compound-learning-elementary/spike-plan.md](docs/plan/compound-learning-elementary/spike-plan.md) | 마스터 플랜 |
| [docs/plan/compound-learning-elementary/T1-foundation.md](docs/plan/compound-learning-elementary/T1-foundation.md) | T1: Foundation (이 ticket) |
| [docs/plan/compound-learning-elementary/T2-auth-family.md](docs/plan/compound-learning-elementary/T2-auth-family.md) | T2: Auth + Family + PIPA |
| [docs/plan/compound-learning-elementary/T3-domain.md](docs/plan/compound-learning-elementary/T3-domain.md) | T3: Pure domain logic |
| [docs/plan/compound-learning-elementary/T4-kid-flow.md](docs/plan/compound-learning-elementary/T4-kid-flow.md) | T4: Kid dashboard |
| [docs/plan/compound-learning-elementary/T5-guardian-flow.md](docs/plan/compound-learning-elementary/T5-guardian-flow.md) | T5: Guardian dashboard |
| [docs/plan/compound-learning-elementary/T6-history-charts.md](docs/plan/compound-learning-elementary/T6-history-charts.md) | T6: uPlot charts |

### ADRs

| ADR | 결정 |
|---|---|
| [ADR-001](docs/adr/ADR-001-tech-stack.md) | Next.js + Supabase + Vercel |
| [ADR-002](docs/adr/ADR-002-monetary-as-bigint.md) | KRW BIGINT integer (no float) |
| [ADR-003](docs/adr/ADR-003-domain-purity-with-typed-boundary.md) | `lib/domain/` IO-free + typed boundary |
| [ADR-004](docs/adr/ADR-004-rls-as-primary-permission.md) | RLS as primary permission |
| [ADR-005](docs/adr/ADR-005-append-only-transactions.md) | Transactions append-only (role + trigger) |
| [ADR-006](docs/adr/ADR-006-weekly-tick-kst-timezone.md) | KST hardcoded, Mon-Sun week |
| [ADR-007](docs/adr/ADR-007-balance-cache-reconciliation.md) | Atomic claim-time write + reconciler |

## Project Structure

```
moneymanager/
├── app/
│   ├── (auth)/       PIPA consent + login (T2)
│   ├── (kid)/        Kid dashboard + claim (T4)
│   ├── (guardian)/   Guardian dashboard + settings (T5)
│   └── api/
│       ├── health           Sunday ping bot endpoint
│       ├── keepalive        Saturday cron (auto-pause prevention)
│       └── cron/monthly-reconcile  Balance reconciliation
├── lib/
│   ├── domain/       Pure functions (compound, claim, mathgen, zones)
│   ├── db/           Supabase client + mappers
│   └── observability/  Logger
├── supabase/
│   ├── migrations/   Numbered SQL with .down.sql counterparts
│   └── config.toml   Local dev config
├── docs/
│   ├── adr/          7 ADRs
│   └── plan/         Spike plan + 6 ticket refs
└── .github/workflows/
    ├── ci.yml        Lint + typecheck + test + build on PR
    └── sunday-ping.yml  Critical window monitoring
```
