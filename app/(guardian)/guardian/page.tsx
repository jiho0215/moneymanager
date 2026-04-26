import { redirect } from 'next/navigation';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { CopyButton } from '@/lib/ui/copy-button';

export const dynamic = 'force-dynamic';
function fmt(n: number) { return n.toLocaleString('ko-KR') + '원'; }

export default async function GuardianHomePage() {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');

  const accounts = ctx.accounts as Array<{
    id: string; membership_id: string; free_balance: number; experiment_balance: number;
    bonus_balance: number; cycle_number: number; cycle_status: string; last_claimed_week_num: number | null;
    starting_capital: number; setup_state?: string;
  }>;
  const kids = ctx.kids as Array<{ id: string; display_name: string; grade: number }>;

  // If any kid still needs parent setup, route to onboarding wizard.
  if (accounts.some((a) => a.setup_state === 'parent_setup_pending')) {
    redirect('/onboarding');
  }

  // Fetch invite tokens for kids that haven't claimed login yet.
  const admin = getSupabaseAdmin();
  const kidIds = kids.map((k) => k.id);
  const { data: pendingClaims } = kidIds.length
    ? await admin.from('memberships').select('id, display_name, invite_token').in('id', kidIds).not('invite_token', 'is', null)
    : { data: [] };
  const inviteByKid = new Map<string, { displayName: string; token: string }>();
  for (const p of (pendingClaims ?? []) as Array<{ id: string; display_name: string; invite_token: string }>) {
    inviteByKid.set(p.id, { displayName: p.display_name, token: p.invite_token });
  }

  return (
    <main className="page page-wide">
      <header style={{ marginBottom: 'var(--sp-4)' }}>
        <div className="soft" style={{ marginBottom: 4 }}>안녕하세요</div>
        <h1 className="h1">👨‍👩‍👧 {ctx.guardian.display_name}</h1>
      </header>

      <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
        자녀의 통장을 한눈에 확인할 수 있어요.
      </p>

      {Array.from(inviteByKid.entries()).map(([kidId, info]) => {
        const url = `https://moneybean.vercel.app/join/${info.token}`;
        return (
          <section
            key={`invite-${kidId}`}
            className="card stack-3"
            style={{ background: 'var(--bonus-bg)', borderColor: 'var(--bonus)', marginBottom: 'var(--sp-4)' }}
          >
            <div>
              <h2 className="h3" style={{ margin: '0 0 4px' }}>
                🔗 {info.displayName} 의 가입 링크
              </h2>
              <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
                자녀가 이 링크로 들어가서 본인 아이디/비밀번호를 만들고 통장을 시작해요.
              </p>
            </div>
            <div
              style={{
                background: 'white',
                padding: 'var(--sp-3)',
                borderRadius: 'var(--r-sm)',
                wordBreak: 'break-all',
                fontFamily: 'monospace',
                fontSize: '0.85rem',
              }}
            >
              {url}
            </div>
            <CopyButton value={url} label="링크 복사" />
          </section>
        );
      })}

      <div className="stack-4">
        {kids.map((kid) => {
          const account = accounts.find((a) => String(a.membership_id) === String(kid.id));
          if (!account) return null;
          const principal = Number(account.free_balance);
          const interest = Number(account.experiment_balance) + Number(account.bonus_balance);
          const total = principal + interest;
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

              <div
                className="amount"
                style={{
                  fontSize: '2rem',
                  fontWeight: 800,
                  textAlign: 'center',
                  color: 'var(--experiment-deep)',
                  padding: 'var(--sp-3) 0',
                }}
              >
                {fmt(total)}
              </div>

              <div
                className="row-between"
                style={{ paddingTop: 'var(--sp-3)', borderTop: '1px dashed var(--border)' }}
              >
                <span className="muted">📥 저금 (원금)</span>
                <span style={{ fontWeight: 600 }}>{fmt(principal)}</span>
              </div>
              <div className="row-between">
                <span className="muted">📈 이자 누적</span>
                <span style={{ fontWeight: 600, color: 'var(--experiment-deep)' }}>
                  {interest > 0 ? '+' : ''}{fmt(interest)}
                </span>
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
