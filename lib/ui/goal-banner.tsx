import type { ReactNode } from 'react';
import { applyWeeklyInterest } from '@/lib/domain/compound';

export type GoalBannerProps = {
  startingBalance: number;
  currentBalance: number;
  weeklyGrowthRateBp: number;
  currentWeekNum: number;
  lastClaimedWeekNum?: number | null;
  totalWeeks?: number;
  kidName: string;
};

function fmt(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

function computeFinalGoal(start: number, rateBp: number, weeks: number): number {
  let b = start;
  for (let i = 0; i < weeks; i += 1) b = applyWeeklyInterest(b, rateBp);
  return b;
}

export function GoalBanner({
  startingBalance,
  currentBalance,
  weeklyGrowthRateBp,
  currentWeekNum,
  totalWeeks = 8,
  kidName,
}: GoalBannerProps) {
  const goal = computeFinalGoal(startingBalance, weeklyGrowthRateBp, totalWeeks);
  const progressPct = Math.min(
    100,
    Math.max(
      0,
      ((currentBalance - startingBalance) /
        Math.max(1, goal - startingBalance)) *
        100
    )
  );
  const weekDone = Math.min(totalWeeks, Math.max(0, currentWeekNum));

  return (
    <section className="goal-banner fade-in">
      <div className="label" style={{ marginBottom: 6 }}>{kidName}의 목표</div>
      <h2 className="h2" style={{ margin: '0 0 var(--sp-4)' }}>
        <span>🌱</span>
        <span style={{ margin: '0 8px', color: 'var(--text-soft)' }}>→</span>
        <span>🌳</span>
        <span style={{ marginLeft: 12 }}>{totalWeeks}주 후</span>
      </h2>

      <div className="row-between" style={{ marginBottom: 12, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
        <span>시작 <strong style={{ color: 'var(--text)' }}>{fmt(startingBalance)}</strong></span>
        <span>{totalWeeks}주 후의 자산 <strong style={{ color: 'var(--experiment-deep)' }}>{fmt(goal)}</strong></span>
      </div>

      <div className="goal-progress-track">
        <div className="goal-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>

      <div className="goal-stage-row" aria-label="주차별 진행">
        {Array.from({ length: totalWeeks }, (_, i) => (
          <div
            key={i}
            className={`goal-stage ${i < weekDone ? 'goal-stage-done' : ''}`}
            title={`${i + 1}주차`}
          />
        ))}
      </div>

      <div className="row-between" style={{ marginTop: 6, fontSize: '0.82rem' }}>
        <span className="soft">{weekDone}/{totalWeeks}주차</span>
        <span className="soft">8주 = 약 1년치 복리 경험</span>
      </div>
    </section>
  );
}

export function GuideCard({ children }: { children: ReactNode }) {
  return (
    <details className="card" style={{ background: 'var(--surface-2)', cursor: 'pointer' }}>
      <summary style={{ fontWeight: 600, fontSize: '0.95rem', listStyle: 'none' }}>
        💡 어떻게 작동하나요?
      </summary>
      <div style={{ marginTop: 'var(--sp-3)', fontSize: '0.92rem', lineHeight: 1.7 }}>{children}</div>
    </details>
  );
}
