import { getGuardianFamilyView } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { logout } from '@/app/(auth)/login/actions';
import { SubmitButton } from '@/lib/ui/submit-button';
import Link from 'next/link';

export const dynamic = 'force-dynamic';
function fmt(n: number) { return n.toLocaleString('ko-KR') + '원'; }

export default async function GuardianHomePage() {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');

  const accounts = ctx.accounts as Array<{
    id: string;
    membership_id: string;
    free_balance: number;
    experiment_balance: number;
    bonus_balance: number;
    cycle_number: number;
    cycle_status: string;
    last_claimed_week_num: number | null;
  }>;
  const kids = ctx.kids as Array<{ id: string; display_name: string; grade: number }>;

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '24px', lineHeight: 1.6 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>👨‍👩‍👧 보호자 대시보드</h1>
        <form action={logout}>
          <SubmitButton variant="subtle" pendingText="..." style={{ padding: '6px 12px' }}>
            로그아웃
          </SubmitButton>
        </form>
      </header>

      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        {ctx.guardian.display_name}님, 안녕하세요. 자녀의 활동을 한눈에 확인할 수 있습니다.
      </p>

      <nav style={{ display: 'flex', gap: '12px', marginBottom: '2rem' }}>
        <Link href="/kid-access" style={{ padding: '8px 16px', backgroundColor: '#16a34a', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
          🔑 자녀 로그인 코드
        </Link>
        <Link href="/settings" style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
          ⚙️ 설정
        </Link>
        <Link href="/audit" style={{ padding: '8px 16px', backgroundColor: '#6b7280', color: 'white', textDecoration: 'none', borderRadius: '4px' }}>
          📋 활동 기록
        </Link>
      </nav>

      {kids.map((kid) => {
        const account = accounts.find((a) => String(a.membership_id) === String(kid.id));
        if (!account) return null;
        const total = Number(account.free_balance) + Number(account.experiment_balance) + Number(account.bonus_balance);
        return (
          <section key={kid.id} style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1rem' }}>
            <h2 style={{ marginTop: 0 }}>🌱 {kid.display_name} ({kid.grade}학년)</h2>
            <p style={{ color: '#666' }}>
              사이클 {account.cycle_number} · 상태: {account.cycle_status} ·
              마지막 청구: {account.last_claimed_week_num !== null ? `${account.last_claimed_week_num}주차` : '없음'}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginTop: '12px' }}>
              <Stat label="자유" value={Number(account.free_balance)} color="#fff8dc" />
              <Stat label="실험" value={Number(account.experiment_balance)} color="#e8f5e9" />
              <Stat label="보너스" value={Number(account.bonus_balance)} color="#e3f2fd" />
              <Stat label="합계" value={total} color="#f3f4f6" bold />
            </div>
          </section>
        );
      })}
    </main>
  );
}

function Stat({ label, value, color, bold }: { label: string; value: number; color: string; bold?: boolean }) {
  return (
    <div style={{ padding: '12px', backgroundColor: color, borderRadius: '6px' }}>
      <div style={{ fontSize: '0.75rem', color: '#666' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: bold ? 'bold' : 600 }}>{fmt(value)}</div>
    </div>
  );
}
