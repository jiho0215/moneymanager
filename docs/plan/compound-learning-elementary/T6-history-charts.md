---
epicId: compound-learning-elementary
ticketId: T6-history-charts
status: planned
implBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "needs schema (weekly_snapshots), RPC"
  - ticketId: T2-auth-family
    kind: hard
    reason: "needs JWT context for RLS"
  - ticketId: T3-domain
    kind: hard
    reason: "uses applyWeeklyInterest for 'if claimed every week' counterfactual curve"
  - ticketId: T4-kid-flow
    kind: hard
    reason: "needs claim flow to have run, generating snapshot data to chart"
deployBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "T1's deployed schema required"
  - ticketId: T4-kid-flow
    kind: hard
    reason: "kid must have made at least 1 claim to have meaningful chart data"
createdAt: 2026-04-25T00:00:00Z
---

# T6-history-charts — Weekly Growth Visualization (uPlot)

## §1 Back-reference

Part of epic [compound-learning-elementary](spike-plan.md). See [spike-plan §7](spike-plan.md#7-tickets) for sibling tickets and current status.

## §2 This Ticket's Role in the Big Picture

T6 는 epic의 **시각적 학습 메시지의 정점**. 매주 잔액이 점점 가팔라지는 곡선을 자녀에게 직접 보여줘서 "복리 = 직선이 아닌 곡선" 직관을 형성한다.

T6 가 머지되면:
- 자녀 dashboard에서 자기 잔액의 주차별 곡선 본다 — 1주차 평평, 8주차 가파름
- "매주 청구한 곡선 vs 실제 곡선" 비교선이 자녀에게 즉시 청구의 가치를 시각화 (Success Criterion §1.2)
- 보호자는 cycle 1 vs cycle 2 비교 가능 (학습이 누적되었는지 검증)

학습 메시지 핵심:
- 곡선이 **점점 가팔라지는** 모양 — 8주째 증가폭이 1주째보다 약 2배 (1.10⁷ × 1000 ≈ 1949 vs 1000)
- 누락 점이 표시되면 자녀가 시각적으로 "아 그때 빠졌구나" 인지
- 비교선의 음영 영역이 "기회비용" — 미래 의사결정에 영향

## §3 Relevant API Contract Slice

### Server Actions

```typescript
// app/(kid)/history/actions.ts (kid 라우트)
async function getMyWeeklyHistory(input: {
  cycleNumber?: number;          // default = current cycle
}): Promise<{
  ok: true;
  cycleNumber: number;
  dataPoints: Array<{
    weekNum: number;
    actualBalance: number;       // 실제 잔액 (snapshots 기반)
    counterfactualBalance: number;  // "매주 청구 가정" 잔액
    claimStatus: 'claimed' | 'skipped' | 'expired_pending' | 'future';
    claimedAt?: string;          // ISO
  }>;
}>;

// app/(guardian)/history/actions.ts (guardian 라우트)
async function getKidWeeklyHistory(input: {
  accountId: string;
  cycleNumber?: number;          // omit = all cycles
}): Promise<{
  ok: true;
  cycles: Array<{
    cycleNumber: number;
    dataPoints: Array<{ /* 위와 같음 */ }>;
  }>;
}>;
```

### Counterfactual 계산

`counterfactualBalance` 는 **`lib/domain/compound.ts` 의 `applyWeeklyInterest` 를 server-side에서 시뮬레이션** 해서 만든다 — 매주 청구했다면의 잔액. 이게 ADR-003 도메인 함수의 자연스러운 사용처.

```typescript
// lib/db/queries.ts 안
async function buildCounterfactualSeries(account, snapshots) {
  let cfBalance = account.startingExperimentBalance;
  return snapshots.map(s => ({
    weekNum: s.weekNum,
    counterfactualBalance: cfBalance = applyWeeklyInterest(cfBalance, account.weeklyGrowthRateBp),
  }));
}
```

## §4 Relevant Migrations

T6 owner:

| # | 변경 | 비고 |
|---|---|---|
| 014 | `weekly_snapshots` index: `(account_id, cycle_number, week_num)` composite | 차트 query 효율화. T6 owner. |

## §5 Relevant Observability Hooks

### Metrics (T6 owner)
- `chart.history_view_total` — 자녀/보호자가 차트 페이지 본 횟수 (engagement metric)
- `chart.render_duration_seconds` — histogram, performance budget 검증용

### Bundle Size Budget (CI 강제)
- `chart` route island ≤ **50KB gzipped**
- uPlot ~15KB + adapter ~3KB + own code ~10KB ≈ 30KB 예상, 안전 마진 충분
- CI: `next build` 출력 분석, 50KB 초과 시 fail

## §6 Implementation Notes

<!-- BEGIN AUTO-GENERATED IMPL LOG -->
_(populated by /implement)_
<!-- END AUTO-GENERATED IMPL LOG -->

## §7 Discoveries / Reference-doc Corrections

_(empty until /implement runs)_

---

## Library Choice (User-confirmed)

**uPlot** ([github.com/leeoniya/uPlot](https://github.com/leeoniya/uPlot)) — MIT 라이선스, ~15KB gzipped, Canvas 기반, 단순 line chart에 최적화.

### React 통합

- Direct integration: `useEffect` + `new uPlot(opts, data, container)`
- 또는 `uplot-react` wrapper 패키지 (~3KB extra)
- 결정은 `/implement` Phase 2 research에서 (둘 다 검증)

### Color Palette 통합

T4 자녀 일러스트 (씨앗→나무) 와 같은 색상 사용:
- 자유 영역: 노란색 계열
- 실험 영역: 초록색 계열 (성장 메타포)
- 보너스 영역: 파란색 계열 (우물)
- counterfactual (가정 곡선): 점선 + 더 옅은 초록 (잠재력 시각화)

### Visual Encoding

| 데이터 | 시각 |
|---|---|
| 실제 잔액 곡선 | solid line, 진한 초록 |
| Counterfactual 곡선 | dashed line, 옅은 초록 |
| 청구 성공 점 | 큰 점, 별 모양 |
| Skip 점 | 작은 점, 회색 |
| Expired pending | X 마크, 빨강 |
| 음영 영역 (기회비용) | 두 곡선 사이 옅은 회색 fill |

---

## Acceptance Criteria

### Integration Tests
- [ ] `getMyWeeklyHistory` 자녀 JWT: 자기 가족 데이터만 반환 (RLS)
- [ ] `getKidWeeklyHistory` 다른 가족 accountId: 0 데이터포인트 (RLS)
- [ ] Counterfactual 계산이 `applyWeeklyInterest` 결과와 정확히 일치 (단위 테스트로도 보장)

### E2E
- [ ] 자녀 4주 진행 + 매주 청구 → 차트에 4 데이터포인트, 곡선 가팔라짐 시각 확인
- [ ] 자녀 4주 진행 중 2주 skip → 실제/counterfactual 차이가 시각적으로 보임 + skip 마커 표시
- [ ] 보호자 cycle 1 + cycle 2 비교 차트 — 두 cycle 곡선 동시 표시

### Bundle Size
- [ ] CI: `app/(kid)/history` 와 `app/(guardian)/history` 라우트의 first-load JS ≤ 50KB gzipped
- [ ] 초과 시 PR fail

### A11Y
- [ ] 차트 옆에 데이터 표 함께 제공 (tabular fallback) — 스크린 리더, 색약, 시각장애 대응
- [ ] uPlot 의 default cursor + tooltip 키보드 도달 가능 (직접 구현 필요할 가능성, T6 research)

### Performance
- [ ] 8주 차트 렌더 < 50ms (uPlot 보장 범위)
- [ ] cycle 8개 동시 렌더 (cumulative all cycles) < 200ms

### Multi-agent Review
- [ ] 5명의 multi-agent review 통과

## Estimated Complexity

작음 ~ 중간. uPlot이 까다로워서 첫 통합에 시간 듦, but 이후는 단순. 가장 까다로운 부분:
- Counterfactual 계산의 cycle 경계 (cycle reset 후 새 starting capital에서 다시 시뮬레이션)
- a11y tabular fallback 디자인
- bundle size CI 셋업 (`@next/bundle-analyzer` 통합)
