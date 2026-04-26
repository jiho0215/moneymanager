# ADR-002: Monetary as BIGINT KRW Integer

**Status**: Accepted
**Date**: 2026-04-25
**Deciders**: spike phase (multi-agent reviewed; performance-reviewer flagged blocking)
**Epic**: compound-learning-elementary

## Context

복리 계산은 결정적(deterministic)이어야 한다. 같은 입력 → 같은 출력이 다른 사용자/시점/머신에서 항상 일치해야 함. 부동소수점 산수는 다음 문제를 일으킨다:

- IEEE 754 누적 오차 (예: `0.1 + 0.2 !== 0.3`)
- 8주 복리 후 `21436.0001` vs `21435.9999` 같은 round-off
- 보호자 화면 vs 자녀 화면 잔액 1원 차이 → 신뢰 붕괴

또한, PostgreSQL `int4` (INTEGER) max = 2,147,483,647 ≈ 21.5억원. 사용 시나리오:
- 시작 자금 1억원, 8주 복리 → 약 2.14억원. `int4` 안전.
- 시작 자금 10억원 → 8주 후 약 21.4억원. **`int4` overflow 직전.**
- multi-tenant 1000 가족 × N 트랜잭션 누적 → integer overflow 위험 더 큼.

## Decision

**모든 화폐 컬럼은 PostgreSQL `BIGINT` (int8). 단위는 KRW 1원.** `Decimal`/`numeric`/`float` 사용 금지.

JavaScript 측: `number` 사용. `Number.MAX_SAFE_INTEGER = 2^53 - 1 ≈ 9 quadrillion` 으로 KRW 어떤 현실 값도 안전.

대상 컬럼 (마이그레이션 003-005):
- `accounts.starting_capital`, `free_balance`, `experiment_balance`, `bonus_balance`, `pending_interest`
- `transactions.amount`
- `weekly_snapshots.{free,experiment,bonus}_balance`, `total`

도메인 함수 규칙:
- 모든 계산은 정수. 곱셈 후 `Math.floor` 명시.
- 기본 공식: `applyWeeklyInterest(b, rate_bp) = Math.floor((b * rate_bp) / 10000) + b` (basis points 사용)
- 1000 bp = 10.00%

## Consequences

### Pros
- Overflow 불가능 (현실 KRW 범위 내)
- 결정적, reproducible
- DB ↔ JS 간 type 일치 (BIGINT는 string으로 직렬화 권장이지만 number safe)
- 감사(audit) 가능: 모든 row 합 = 정확한 잔액 (ADR-007)

### Cons
- 모든 곱셈에 `Math.floor` 명시 필요
- `Decimal` 사용 시보다 표현력 떨어지지만 KRW 1원 단위 정밀도 충분
- JS Number 53-bit 한계 vs DB BIGINT 64-bit: extreme edge case 차이 — 현실 시나리오 N/A

## Alternatives Considered

- **`int4` INTEGER**: rejected. multi-tenant 확장 시 overflow.
- **`numeric(18,2)` Decimal**: rejected. KRW 소수점 없음, overkill.
- **JS `bigint`**: rejected. JSON 직렬화 복잡, RPC 결과 처리 까다로움. Number로 충분.
- **Float / double**: rejected. 결정적 산수 위배.

## Test Implications (§8 참조)

- Property test (fast-check): `applyWeeklyInterest(b, rate)` 결과 ∈ `[b, b * 1.10 + 1]`, non-decreasing
- Boundary test: 0, 1, MAX_SAFE_INTEGER, 음수 (defensive throw)
- 8주 시퀀스 정확성: `applyWeeklyInterest^8(10000) === 21435`
