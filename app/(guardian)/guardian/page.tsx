import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { logout } from '@/app/(auth)/login/actions';
import { SubmitButton } from '@/lib/ui/submit-button';

export const dynamic = 'force-dynamic';
function fmt(n: number) { return n.toLocaleString('ko-KR') + '원'; }

export default async function GuardianHomePage() {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');

  const accounts = ctx.accounts as Array<{
    id: string; membership_id: string; free_balance: number; experiment_balance: number;
    bonus_balance: number; cycle_number: number; cycle_status: string; last_claimed_week_num: number | null;
  }>;
  const kids = ctx.kids as Array<{ id: string; display_name: string; grade: number }>;

  return (
    <main className="page page-wide">
      <header className="row-between" style={{ marginBottom: 'var(--sp-5)' }}>
        <div>
          <div className="soft" style={{ marginBottom: 4 }}>안녕하세요</div>
          <h1 className="h1">👨‍👩‍👧 {ctx.guardian.display_name}</h1>
        </div>
        <form action={logout}>
          <SubmitButton variant="subtle" pendingText="..." style={{ padding: '8px 14px', fontSize: '0.85rem' }}>
            로그아웃
          </SubmitButton>
        </form>
      </header>

      <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
        자녀의 활동을 한눈에 확인할 수 있어요.
      </p>

      <nav className="row gap-2" style={{ marginBottom: 'var(--sp-6)', flexWrap: 'wrap' }}>
        <Link href="/kid-access" className="btn btn-success">🔑 자녀 로그인 코드</Link>
        <Link href="/settings" className="btn btn-primary">⚙️ 설정 + 입금</Link>
        <Link href="/audit" className="btn btn-subtle">📋 활동 기록</Link>
      </nav>

      <div className="stack-4">
        {kids.map((kid) => {
          const account = accounts.find((a) => String(a.membership_id) === String(kid.id));
          if (!account) return null;
          const total = Number(account.free_balance) + Number(account.experiment_balance) + Number(account.bonus_balance);
          const lastClaim = account.last_claimed_week_num;
          return (
            <section key={kid.id} className="card stack-3">
              <div className="row-between">
                <h2 className="h2">🌱 {kid.display_name} <span className="soft" style={{ fontWeight: 400 }}>({kid.grade}학년)</span></h2>
                <div className="row gap-2">
                  <span className={`badge ${account.cycle_status === 'active' ? 'badge-success' : 'badge-muted'}`}>
                    사이클 {account.cycle_number} · {account.cycle_status}
                  </span>
                  {lastClaim !== null && (
                    <span className="badge badge-info">마지막 청구 {Number(lastClaim)}주차</span>
                  )}
                </div>
              </div>

              <div className="grid-3">
                <Stat tint="free" label="자유" amount={Number(account.free_balance)} icon="👛" />
                <Stat tint="experiment" label="실험" amount={Number(account.experiment_balance)} icon="🌳" />
                <Stat tint="bonus" label="보너스" amount={Number(account.bonus_balance)} icon="💧" />
              </div>

              <div className="row-between" style={{ paddingTop: 'var(--sp-3)', borderTop: '1px solid var(--border)' }}>
                <span className="muted">합계</span>
                <span className="amount amount-lg">{fmt(total)}</span>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}

function Stat({ tint, label, amount, icon }: { tint: 'free' | 'experiment' | 'bonus'; label: string; amount: number; icon: string }) {
  return (
    <div className={`card card-tinted-${tint}`} style={{ padding: 'var(--sp-4)' }}>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <span className="label" style={{ color: `var(--${tint}-deep)` }}>{label}</span>
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
      </div>
      <div className="amount" style={{ fontSize: '1.25rem', color: `var(--${tint}-deep)` }}>{fmt(amount)}</div>
    </div>
  );
}
