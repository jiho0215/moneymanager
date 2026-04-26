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
      <div
        className="label"
        style={{ marginBottom: 'var(--sp-4)', textAlign: 'center' }}
      >
        {kidName}의 {totalWeeks}주 목표
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-5)',
        }}
      >
        <BeforeAfterCell emoji="🌱" amount={fmt(startingBalance)} label="시작" />
        <span
          aria-hidden
          style={{ fontSize: '1.5rem', color: 'var(--text-soft)', lineHeight: 1 }}
        >
          →
        </span>
        <BeforeAfterCell
          emoji="🌳"
          amount={fmt(goal)}
          label={`${totalWeeks}주 후`}
          highlight
        />
      </div>

      <div className="goal-progress-track">
        <div className="goal-progress-fill" style={{ width: `${progressPct}%` }} />
      </div>
      <div
        className="soft"
        style={{ fontSize: '0.82rem', marginTop: 6, textAlign: 'center' }}
      >
        {weekDone}/{totalWeeks}주차
      </div>
    </section>
  );
}

function BeforeAfterCell({
  emoji,
  amount,
  label,
  highlight = false,
}: {
  emoji: string;
  amount: string;
  label: string;
  highlight?: boolean;
}) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '2rem', lineHeight: 1, marginBottom: 6 }}>{emoji}</div>
      <div
        className="amount"
        style={{
          fontSize: '1.4rem',
          fontWeight: 700,
          color: highlight ? 'var(--experiment-deep)' : 'var(--text)',
          letterSpacing: '-0.01em',
        }}
      >
        {amount}
      </div>
      <div className="soft" style={{ fontSize: '0.82rem', marginTop: 2 }}>
        {label}
      </div>
    </div>
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
