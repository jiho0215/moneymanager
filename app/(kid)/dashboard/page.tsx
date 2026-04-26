import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyKidAccount, getCurrentWeekNum } from '@/lib/db/queries';
import { GoalBanner, GuideCard } from '@/lib/ui/goal-banner';
import { RememberKidOnMount } from '@/lib/ui/remember-on-mount';

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

      {canClaimNow && (
        <div style={{ marginBottom: 'var(--sp-5)' }}>
          <Link
            href="/claim"
            className="btn btn-success btn-lg btn-block"
            style={{ textAlign: 'center', justifyContent: 'center', padding: '20px', fontSize: '1.15rem' }}
          >
            ✨ 산수 풀고 이번 주 이자 받기 →
          </Link>
        </div>
      )}

      <section className="card" style={{ marginBottom: 'var(--sp-5)', padding: 'var(--sp-5)' }}>
        <div className="row-between" style={{ marginBottom: 'var(--sp-4)' }}>
          <h2 className="h3" style={{ margin: 0 }}>💰 내 통장</h2>
          <span className="soft">{week === 0 ? '시작 전' : `${week}주차`}</span>
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

      <section style={{ marginBottom: 'var(--sp-5)' }}>
        <Link href="/history" className="btn btn-subtle btn-block" style={{ justifyContent: 'center' }}>
          📊 내 통장 자라는 곡선 보기
        </Link>
      </section>

      <GuideCard>
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          <li><strong>저금</strong>: 부모님이 통장에 넣어준 원금이에요.</li>
          <li><strong>이자</strong>: 매주 산수 풀고 청구하면 통장 전체가 10% 자라요.</li>
          <li><strong>매주 일요일</strong>: 가족 시간! 산수 한 문제 풀고 이자 받기.</li>
          <li><strong>4주 안에 청구 안 하면</strong>: 그 다음부터 한 주씩 사라져요. 의식이 가치예요.</li>
        </ul>
      </GuideCard>
    </main>
  );
}
