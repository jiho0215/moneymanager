import type { ReactNode } from 'react';
import { applyWeeklyInterest } from '@/lib/domain/compound';

export type GoalBannerProps = {
  startingBalance: number;
  currentBalance: number;
  weeklyGrowthRateBp: number;
  currentWeekNum: number;
  lastClaimedWeekNum: number | null;
  totalWeeks?: number;
  kidName: string;
};

const WEEK_STAGE_EMOJIS = ['🌱', '🌱', '🌿', '🌿', '🌳', '🌳', '🎋', '🌲'];

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
  lastClaimedWeekNum,
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
  const stageEmoji = WEEK_STAGE_EMOJIS[Math.min(WEEK_STAGE_EMOJIS.length - 1, weekDone)];

  const weeklyAdd = applyWeeklyInterest(currentBalance, weeklyGrowthRateBp) - currentBalance;
  const canClaimNow =
    currentWeekNum > 0 && (lastClaimedWeekNum === null || lastClaimedWeekNum < currentWeekNum);

  return (
    <section className="goal-banner fade-in">
      <div className="row-between" style={{ marginBottom: 'var(--sp-4)', alignItems: 'flex-start' }}>
        <div>
          <div className="label" style={{ marginBottom: 6 }}>{kidName}의 목표</div>
          <h2 className="h1" style={{ margin: 0 }}>
            <span style={{ marginRight: 8 }}>🌱</span>
            <span style={{ color: 'var(--text-soft)' }}>→</span>
            <span style={{ marginLeft: 8 }}>🌳</span>
            <span style={{ marginLeft: 12 }}>{totalWeeks}주 후의 너</span>
          </h2>
        </div>
        <div style={{ fontSize: '2.5rem', lineHeight: 1 }}>{stageEmoji}</div>
      </div>

      <div className="row-between" style={{ marginBottom: 12, fontSize: '0.92rem', color: 'var(--text-muted)' }}>
        <span>지금 <strong style={{ color: 'var(--text)' }}>{fmt(currentBalance)}</strong></span>
        <span>목표 <strong style={{ color: 'var(--experiment-deep)' }}>{fmt(goal)}</strong></span>
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

      <div
        className="row gap-3"
        style={{
          marginTop: 'var(--sp-5)',
          padding: 'var(--sp-3) var(--sp-4)',
          background: 'rgba(255,255,255,0.7)',
          borderRadius: 'var(--r-md)',
          fontSize: '0.95rem',
        }}
      >
        <span style={{ fontSize: '1.4rem' }}>{canClaimNow ? '✨' : '⏳'}</span>
        <div style={{ flex: 1 }}>
          {canClaimNow ? (
            <>
              <strong>이번 주 청구하면 +{fmt(weeklyAdd)}!</strong>
              <div className="soft" style={{ marginTop: 2 }}>
                산수 한 문제 풀고 이자 받으면 통장이 자라요.
              </div>
            </>
          ) : currentWeekNum === 0 ? (
            <>
              <strong>다음 월요일부터 첫 주가 시작돼요</strong>
              <div className="soft" style={{ marginTop: 2 }}>
                매주 일요일에 산수 한 문제 풀면 통장에 이자 +10% 받기 시작!
              </div>
            </>
          ) : (
            <>
              <strong>이번 주는 청구 완료 ✅</strong>
              <div className="soft" style={{ marginTop: 2 }}>
                다음 주에 또 만나요. 그때 +{fmt(weeklyAdd)} 더!
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function GuideCard({ children }: { children: ReactNode }) {
  return (
    <details className="card" style={{ background: 'var(--surface-2)', cursor: 'pointer' }}>
      <summary style={{ fontWeight: 600, fontSize: '0.95rem', listStyle: 'none' }}>
        💡 어떻게 작동하나요? (눌러서 보기)
      </summary>
      <div style={{ marginTop: 'var(--sp-3)', fontSize: '0.92rem', lineHeight: 1.7 }}>{children}</div>
    </details>
  );
}
