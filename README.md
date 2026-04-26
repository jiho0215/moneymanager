# Compound Learning System

가족용 복리 학습 웹앱. 초등 5-6학년 자녀가 7-8주 안에 잔액이 2배가 되는 경험을 통해 **"시간이 돈을 키운다 (복리)"** 와 **"청구해야 받는다 (자본주의의 작동)"** 두 핵심 개념을 체험합니다.

## 현재 상태

- 📐 **Spike completed** (2026-04-25) — design + 6 tickets + 7 ADRs
- 🚧 **Implementation pending** — T1-foundation부터 시작

## Documentation

| 파일 | 내용 |
|---|---|
| [docs/plan/compound-learning-elementary/spike-plan.md](docs/plan/compound-learning-elementary/spike-plan.md) | 마스터 플랜 (req, arch, ops, observability, API, migrations, tests) |
| [docs/plan/compound-learning-elementary/T1-foundation.md](docs/plan/compound-learning-elementary/T1-foundation.md) | Project skeleton + Schema + RLS |
| [docs/plan/compound-learning-elementary/T2-auth-family.md](docs/plan/compound-learning-elementary/T2-auth-family.md) | Auth + Family + PIPA consent |
| [docs/plan/compound-learning-elementary/T3-domain.md](docs/plan/compound-learning-elementary/T3-domain.md) | Pure domain logic |
| [docs/plan/compound-learning-elementary/T4-kid-flow.md](docs/plan/compound-learning-elementary/T4-kid-flow.md) | Kid dashboard + claim flow |
| [docs/plan/compound-learning-elementary/T5-guardian-flow.md](docs/plan/compound-learning-elementary/T5-guardian-flow.md) | Guardian dashboard + audit |
| [docs/plan/compound-learning-elementary/T6-history-charts.md](docs/plan/compound-learning-elementary/T6-history-charts.md) | uPlot visualization |
| [docs/adr/](docs/adr/) | 7 ADRs covering tech stack, BIGINT, domain purity, RLS, append-only, KST timezone, balance reconciliation |

## Tech Stack

- Next.js 14 (App Router, Server Actions, TypeScript)
- Supabase (Postgres + Auth + Row Level Security)
- Vercel (hosting + cron)
- uPlot (visualization)

## Approach

- **Spike-driven**: 모든 architectural 결정이 코드 작성 전 commit (3500+ lines of plan docs)
- **Multi-agent reviewed**: 5명의 전문가 에이전트 (requirements, architect, observability, performance, test-strategy)
- **ADR 기반**: 7 ADRs 가 6개월 후 "왜 이렇게 했지?" 질문에 답함
