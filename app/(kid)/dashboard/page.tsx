import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyKidAccount, getCurrentWeekNum } from '@/lib/db/queries';
import { logout } from '@/app/(auth)/login/actions';
import { transferToExperiment } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';
import { GoalBanner, GuideCard } from '@/lib/ui/goal-banner';
import { getSupabaseServerClient } from '@/lib/db/client';

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
  const free = Number(account.free_balance);
  const exp = Number(account.experiment_balance);
  const bonus = Number(account.bonus_balance);
  const lastClaimed = account.last_claimed_week_num !== null ? Number(account.last_claimed_week_num) : null;
  const canClaimNow = week > Number(account.week_num_started) && (lastClaimed === null || lastClaimed < week);

  const supabase = await getSupabaseServerClient();
  const { data: initialTx } = await supabase
    .from('transactions')
    .select('amount')
    .eq('account_id', accountId)
    .eq('transaction_type', 'initial_deposit')
    .eq('zone', 'experiment')
    .limit(1);
  const startingExp = initialTx?.[0] ? Number((initialTx[0] as { amount: number }).amount) : exp;
  const total = free + exp + bonus;

  return (
    <main className="page">
      <header className="row-between" style={{ marginBottom: 'var(--sp-5)' }}>
        <div>
          <div className="soft" style={{ marginBottom: 4 }}>안녕하세요</div>
          <h1 className="h1">🌱 {membership.display_name}</h1>
        </div>
        <form action={logout}>
          <SubmitButton variant="subtle" pendingText="..." style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            로그아웃
          </SubmitButton>
        </form>
      </header>

      <div style={{ marginBottom: 'var(--sp-5)' }}>
        <GoalBanner
          startingExperimentBalance={startingExp}
          currentExperimentBalance={exp}
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

      <section style={{ marginBottom: 'var(--sp-5)' }}>
        <div className="row-between" style={{ marginBottom: 'var(--sp-3)' }}>
          <h2 className="h2">💰 내 잔액</h2>
          <span className="soft">합계 {fmt(total)}</span>
        </div>
        <div className="grid-3">
          <ZoneCard tint="free" icon="👛" label="자유 영역" amount={free} note="마음껏 써도 돼요" />
          <ZoneCard tint="experiment" icon="🌳" label="실험 영역" amount={exp} note="매주 10% 자라요" />
          <ZoneCard tint="bonus" icon="💧" label="보너스" amount={bonus} note="부모님이 채워줘요" />
        </div>
      </section>

      <section className="card" style={{ marginBottom: 'var(--sp-5)' }}>
        <h2 className="h3" style={{ marginBottom: 'var(--sp-3)' }}>
          👛 → 🌳 자유 영역에서 실험 영역으로 옮기기
        </h2>
        <p className="muted" style={{ margin: '0 0 var(--sp-3)', fontSize: '0.92rem' }}>
          실험 영역에 더 넣으면 매주 더 많이 자라요. 단, 옮긴 돈은 1주 동안 못 빼요.
        </p>
        <form action={transferToExperiment} className="row gap-2">
          <input
            type="number"
            name="amount"
            min={100}
            max={free}
            step={100}
            placeholder="얼마? (100원 단위)"
            required
            style={{ flex: 1 }}
          />
          <SubmitButton variant="warn" pendingText="옮기는 중...">
            옮기기
          </SubmitButton>
        </form>
      </section>

      <section style={{ marginBottom: 'var(--sp-5)' }}>
        <Link href="/history" className="btn btn-subtle btn-block" style={{ justifyContent: 'center' }}>
          📊 내 잔액 변화 차트로 보기
        </Link>
      </section>

      <GuideCard>
        <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
          <li><strong>자유 영역</strong>: 너의 돈, 언제든 써도 OK.</li>
          <li><strong>실험 영역</strong>: 매주 10%씩 자라는 곳. 매주 산수 풀면 이자가 잠금해제.</li>
          <li><strong>보너스</strong>: 실험영역에 더 넣으면 부모님이 비율대로 같이 채워줘요.</li>
          <li><strong>매주 일요일</strong>: 가족 시간! 산수 풀고 이자 받기.</li>
          <li><strong>4주 안에 청구 안 하면</strong>: 그 다음부터 한 주씩 사라져요. 의식이 가치예요.</li>
        </ul>
      </GuideCard>
    </main>
  );
}

function ZoneCard({
  tint, icon, label, amount, note,
}: {
  tint: 'free' | 'experiment' | 'bonus';
  icon: string; label: string; amount: number; note: string;
}) {
  return (
    <div className={`card card-tinted-${tint}`}>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <span className="label" style={{ color: `var(--${tint}-deep)` }}>{label}</span>
        <span style={{ fontSize: '1.4rem' }}>{icon}</span>
      </div>
      <div className="amount amount-lg" style={{ color: `var(--${tint}-deep)` }}>{fmt(amount)}</div>
      <div className="soft" style={{ marginTop: 6 }}>{note}</div>
    </div>
  );
}
