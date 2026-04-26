import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyKidAccount, getCurrentWeekNum } from '@/lib/db/queries';
import { getSupabaseServerClient } from '@/lib/db/client';
import { GoalBanner, GuideCard } from '@/lib/ui/goal-banner';
import { RememberKidOnMount } from '@/lib/ui/remember-on-mount';
import { ScrubChart, type ActualHistoryPoint } from '@/lib/ui/scrub-chart';

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

  const startingCapital = Number(account.starting_capital);
  const ratePct = Math.round(Number(account.weekly_growth_rate_bp ?? 1000) / 100);

  const supabase = await getSupabaseServerClient();
  const { data: snaps } = await supabase
    .from('weekly_snapshots')
    .select('week_num, free_balance, experiment_balance, bonus_balance')
    .eq('account_id', accountId)
    .eq('cycle_number', Number(account.cycle_number))
    .order('week_num', { ascending: true });

  const actualHistory: ActualHistoryPoint[] = ((snaps ?? []) as Array<{
    week_num: number;
    free_balance: number;
    experiment_balance: number;
    bonus_balance: number;
  }>).map((s) => ({
    tick: Number(s.week_num),
    balance: Number(s.free_balance) + Number(s.experiment_balance) + Number(s.bonus_balance),
  }));
  if (week > 0 && (actualHistory.length === 0 || actualHistory[actualHistory.length - 1]!.tick < week)) {
    actualHistory.push({ tick: week, balance: total });
  }

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
          style={{ paddingTop: 'var(--sp-3)', borderTop: '1px dashed var(--border)' }}
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

      <section className="card stack-3" style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 className="h3" style={{ margin: 0 }}>🎯 다음 할 일</h2>
        <NextActivity canClaimNow={canClaimNow} week={week} lastClaimed={lastClaimed} />
      </section>

      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <GoalBanner
          startingBalance={startingCapital}
          currentBalance={total}
          weeklyGrowthRateBp={Number(account.weekly_growth_rate_bp ?? 1000)}
          currentWeekNum={week}
          lastClaimedWeekNum={lastClaimed}
          totalWeeks={8}
          kidName={membership.display_name}
        />
      </div>

      <section className="stack-4" style={{ marginBottom: 'var(--sp-5)' }}>
        <ScrubChart
          initialPrincipal={startingCapital}
          initialRatePct={ratePct}
          initialMode="weeks"
          initialMaxTicks={8}
          initialAddition={0}
          initialScenario="one-time"
          initialTick={Math.min(8, Math.max(0, week))}
          actualHistory={actualHistory}
          actualLabel="🔵 나의 실제"
          hideScenarioTabs
          hideControls
          hideBreakdown
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
        <WaitOption label="② ⏳ 기다리기 — 단, 이번 주 안에 풀어야 이자가 들어가요." muted />
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
          ① 산수 풀기 — 첫 일요일 첫 주 시작 후 가능
        </div>
        <WaitOption label="② ⏳ 그때까지 기다리기" />
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
      <WaitOption label="② ⏳ 다음 일요일까지 기다리기" />
    </div>
  );
}

function WaitOption({ label, muted = false }: { label: string; muted?: boolean }) {
  const baseStyle: React.CSSProperties = muted
    ? {
        background: 'var(--surface-2)',
        color: 'var(--text-muted)',
        fontSize: '0.92rem',
      }
    : {
        background: 'var(--experiment-bg)',
        border: '1px solid var(--experiment)',
        color: 'var(--experiment-deep)',
        fontWeight: 600,
      };
  return (
    <details
      style={{
        borderRadius: 'var(--r-sm)',
        overflow: 'hidden',
        ...baseStyle,
      }}
    >
      <summary
        style={{
          padding: 'var(--sp-4)',
          textAlign: 'center',
          cursor: 'pointer',
          listStyle: 'none',
          userSelect: 'none',
        }}
      >
        {label} <span style={{ opacity: 0.6, fontSize: '0.85rem' }}>(왜? 누르기)</span>
      </summary>
      <div
        style={{
          padding: 'var(--sp-4)',
          background: 'rgba(255,255,255,0.7)',
          color: 'var(--text)',
          fontWeight: 400,
          fontSize: '0.95rem',
          textAlign: 'left',
          lineHeight: 1.7,
          borderTop: '1px solid var(--border)',
        }}
      >
        <h4 style={{ margin: '0 0 var(--sp-3)', fontSize: '1.05rem' }}>
          🤔 왜 지금은 기다려야 해?
        </h4>

        <p style={{ margin: '0 0 var(--sp-3)' }}>
          <strong>🌱 통장의 돈은 매주 한 번 자라요.</strong>
          <br />
          은행이나 적금처럼, 한 주가 지나야 이자가 만들어져. 한 주가 안 지났는데
          이자를 받으려고 하면, <em>아직 만들어지지 않은 돈</em>을 달라는 거야.
        </p>

        <p style={{ margin: '0 0 var(--sp-3)' }}>
          <strong>⏳ 시간이 일을 해.</strong>
          <br />
          네가 잠자고, 학교 가고, 노는 동안에도 — 통장에 들어있는 돈이 일하고
          있어. 이걸 <strong>복리(複利)</strong>라고 해. 이자에 또 이자가
          붙어서, <em>가만히 있어도</em> 돈이 돈을 벌어주는 거야.
        </p>

        <p style={{ margin: '0 0 var(--sp-3)' }}>
          <strong>🎯 그래서 너의 진짜 일은 두 가지.</strong>
        </p>
        <ol style={{ margin: '0 0 var(--sp-3)', paddingLeft: '1.4rem' }}>
          <li>시간이 흐르길 기다리기 — <em>가만히 있는 것도 중요한 일</em>이에요!</li>
          <li>매주 일요일에 잊지 않고 산수 풀고 청구하기</li>
        </ol>

        <p style={{ margin: 0, padding: 'var(--sp-3)', background: 'var(--experiment-bg)', borderRadius: 'var(--r-sm)' }}>
          <strong>💎 부자가 되는 사람들의 비밀</strong>
          <br />
          <strong>참을성</strong> (빨리 받으려 하지 않기) + <strong>꾸준함</strong> (매주
          한 번씩 빠짐없이 챙기기). 너는 지금 그 연습을 하고 있어. 멋지지?
        </p>
      </div>
    </details>
  );
}
