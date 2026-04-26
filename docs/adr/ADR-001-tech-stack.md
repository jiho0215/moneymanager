# ADR-001: Tech Stack — Next.js + Supabase + Vercel

**Status**: Accepted
**Date**: 2026-04-25
**Deciders**: spike phase (multi-agent reviewed)
**Epic**: compound-learning-elementary

## Context

가족용 복리 학습 웹앱. 요구사항:
- 한국어 UI, 초등 5-6 자녀가 1차 사용자
- 가족 단위 데이터 격리 + 보호자/자녀 권한 분리
- 1팀 MVP, multi-tenant 확장 준비
- 무료 티어로 운영 (가족용 토이 프로젝트 → 추후 SaaS 가능성)
- 매주 일요일 19-21 KST critical window

후보:
1. **Next.js 14 + Supabase + Vercel** (최종 선택)
2. SvelteKit + Turso (SQLite at edge)
3. 순수 HTML + Cloudflare Pages + D1

## Decision

**Next.js 14 (App Router, RSC, Server Actions, TypeScript) + Supabase (Postgres + Auth + RLS) + Vercel hosting + ap-northeast-1 (Tokyo) Supabase region**

## Consequences

### Pros
- Vercel ↔ Next.js 1차 시민 결합. 디버깅 자료/AI 도움 압도적 풍부
- Supabase Row-Level Security 가 권한 모델의 핵심에 부합 (ADR-004)
- 무료 티어가 MVP/single-family 사용 충분히 커버
- TypeScript = 정수 산수 등 도메인 정확성에 도움
- Server Actions 로 별도 REST API 층 불필요 → 코드량↓

### Cons / Trade-offs
- **Supabase free tier auto-pause** (1주 비활성 시 일시정지) — Saturday keepalive cron으로 우회 (§1.4.5). 사용자 증가 시 Pro $25/월
- TypeScript 학습 부담 (단, 도메인 정확성 가치가 더 큼)
- ap-northeast-1 region: 한국 사용자 latency 50-100ms (수용 가능)
- 모바일 네이티브 앱 추가 시 Server Actions 재구성 필요 (현재 single-client scope이므로 OK)

## Alternatives Considered

- **SvelteKit + Turso**: 코드량 30% 적지만 커뮤니티/AI 자료 1/5. 디버깅 막힐 위험.
- **Vanilla HTML + CF Pages + D1**: 가장 단순/저렴이지만 인증/세션 직접 구현 → 보안 사고 위험.

## Compliance Notes

- 데이터 위치: Supabase ap-northeast-1 (Tokyo). 한국 region 미존재. Privacy policy에 명시.
- 향후 Pro 업그레이드 시 PITR 함께 활성화 (§3.3 rollback).
