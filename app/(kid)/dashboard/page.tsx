import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyKidAccount, getCurrentWeekNum } from '@/lib/db/queries';
import { GoalBanner, GuideCard } from '@/lib/ui/goal-banner';
import { RememberKidOnMount } from '@/lib/ui/remember-on-mount';
import { ProjectionChart } from '@/lib/ui/projection-chart';

export const dynamic = 'force-dynamic';

function fmt(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

export default async function KidDashboardPage() {
  const ctx = await getMyKidAccount();
  if (!ctx) redirect('/login');

  const { membership, account } = ctx;
  const accountId = String(account.id);
  const week = await getCurrentWeekNum(accountId);
  const principal = Number(account.free_balance);
  const interest = Number(account.experiment_balance) + Number(account.bonus_balance);
  const total = principal + interest;
  const lastClaimed = account.last_claimed_week_num !== null ? Number(account.last_claimed_week_num) : null;
  const canClaimNow = week > Number(account.week_num_started) && (lastClaimed === null || lastClaimed < week);

  return (
    <main className="page">
      <RememberKidOnMount
        nickname={ctx.membership.display_name}
        guardianName={ctx.guardianName}
      />
      <header style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="soft" style={{ marginBottom: 4 }}>안녕하세요</div>
        <h1 className="h1">🌱 {membership.display_name}</h1>
      </header>

      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <GoalBanner
          startingBalance={Number(account.starting_capital)}
          currentBalance={total}
          weeklyGrowthRateBp={Number(account.weekly_growth_rate_bp ?? 1000)}
          currentWeekNum={week}
          lastClaimedWeekNum={lastClaimed}
          totalWeeks={8}
          kidName={membership.display_name}
        />
      </div>

      <section className="card stack-3" style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 className="h3" style={{ margin: 0 }}>🎯 다음 할 일</h2>
        <NextActivity canClaimNow={canClaimNow} week={week} lastClaimed={lastClaimed} />
      </section>


      <section className="card" style={{ marginBottom: 'var(--sp-5)', padding: 'var(--sp-5)' }}>
        <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="h3" style={{ margin: 0 }}>💰 내 통장</h2>
          {week > 0 && <span className="soft">{week}주차</span>}
        </div>

        <div
          className="amount"
          style={{
            fontSize: '2.4rem',
            fontWeight: 800,
            textAlign: 'center',
            color: 'var(--experiment-deep)',
            marginBottom: 'var(--sp-4)',
          }}
        >
          {fmt(total)}
        </div>

        <div
          className="stack-2"
          style={{
            paddingTop: 'var(--sp-3)',
            borderTop: '1px dashed var(--border)',
          }}
        >
          <div className="row-between">
            <span className="muted">📥 저금 (원금)</span>
            <span style={{ fontWeight: 600 }}>{fmt(principal)}</span>
          </div>
          <div className="row-between">
            <span className="muted">📈 이자</span>
            <span style={{ fontWeight: 600, color: 'var(--experiment-deep)' }}>
              {interest > 0 ? '+' : ''}{fmt(interest)}
            </span>
          </div>
        </div>
      </section>

      <section className="card stack-4" style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 className="h3" style={{ margin: 0 }}>📐 내 저금 계획</h2>
        <div
          className="grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 'var(--sp-2) var(--sp-3)',
            fontSize: '0.92rem',
          }}
        >
          <div className="muted">시작 원금</div>
          <div style={{ fontWeight: 600 }}>{fmt(Number(account.starting_capital))}</div>
          <div className="muted">저금 방식</div>
          <div style={{ fontWeight: 600 }}>매주 산수 풀고 청구 (능동 복리)</div>
          <div className="muted">주간 이자</div>
          <div style={{ fontWeight: 600 }}>{Number(account.weekly_growth_rate_bp ?? 1000) / 100}% / 주</div>
          <div className="muted">기간</div>
          <div style={{ fontWeight: 600 }}>8주 (≈ 1년치 복리 경험)</div>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
          매주 빠짐없이 청구했을 때의 예상 곡선이에요. 현재 위치(●)가 곡선 위에 있으면 잘 따라가고 있는 거예요.
        </p>
        <ProjectionChart
          startingPrincipal={Number(account.starting_capital)}
          weeklyRateBp={Number(account.weekly_growth_rate_bp ?? 1000)}
          totalWeeks={8}
          currentWeek={week}
          currentBalance={total}
        />
      </section>

      <section style={{ marginBottom: 'var(--sp-5)' }}>
        <Link href="/history" className="btn btn-subtle btn-block" style={{ justifyContent: 'center' }}>
          📊 자세한 히스토리 보기
        </Link>
      </section>

      <GuideCard>
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          <li><strong>저금</strong>: 통장에 들어있는 너의 원금이에요.</li>
          <li><strong>이자</strong>: 통장 전체가 매주 10%씩 자라요.</li>
          <li><strong>매주 일요일에 청구</strong>: 산수 한 문제 풀고 <strong>이번 주 이자</strong>를 통장에 넣기. 그 주 안에 안 하면 그 주 이자는 사라져요.</li>
        </ul>
      </GuideCard>
    </main>
  );
}

function NextActivity({
  canClaimNow,
  week,
  lastClaimed,
}: {
  canClaimNow: boolean;
  week: number;
  lastClaimed: number | null;
}) {
  if (canClaimNow) {
    return (
      <div className="stack-3">
        <Link
          href="/claim"
          className="btn btn-success btn-lg btn-block"
          style={{ textAlign: 'center', justifyContent: 'center', padding: '20px', fontSize: '1.1rem' }}
        >
          ① ✨ 산수 풀고 이번 주 이자 받기 →
        </Link>
        <div
          className="muted"
          style={{
            textAlign: 'center',
            fontSize: '0.92rem',
            padding: 'var(--sp-2)',
            background: 'var(--surface-2)',
            borderRadius: 'var(--r-sm)',
          }}
        >
          ② ⏳ 기다리기 — 단, 이번 주 안에 풀어야 이자가 들어가요.
        </div>
      </div>
    );
  }
  if (week === 0) {
    return (
      <div className="stack-3">
        <div
          style={{
            padding: 'var(--sp-4)',
            background: 'var(--surface-2)',
            borderRadius: 'var(--r-sm)',
            opacity: 0.6,
            textAlign: 'center',
          }}
        >
          ① 산수 풀기 — 다음 월요일 첫 주 시작 후 가능
        </div>
        <div
          style={{
            padding: 'var(--sp-4)',
            background: 'var(--experiment-bg)',
            borderRadius: 'var(--r-sm)',
            border: '1px solid var(--experiment)',
            textAlign: 'center',
            color: 'var(--experiment-deep)',
            fontWeight: 600,
          }}
        >
          ② ⏳ 그때까지 기다리기
        </div>
      </div>
    );
  }
  return (
    <div className="stack-3">
      <div
        style={{
          padding: 'var(--sp-4)',
          background: 'var(--surface-2)',
          borderRadius: 'var(--r-sm)',
          opacity: 0.6,
          textAlign: 'center',
        }}
      >
        ① 산수 풀기 — ✅ {lastClaimed}주차 청구 완료
      </div>
      <div
        style={{
          padding: 'var(--sp-4)',
          background: 'var(--experiment-bg)',
          borderRadius: 'var(--r-sm)',
          border: '1px solid var(--experiment)',
          textAlign: 'center',
          color: 'var(--experiment-deep)',
          fontWeight: 600,
        }}
      >
        ② ⏳ 다음 일요일까지 기다리기
      </div>
    </div>
  );
}
