import { getMyKidAccount, getCurrentWeekNum } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { logout } from '@/app/(auth)/login/actions';
import { transferToExperiment } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

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

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '24px', lineHeight: 1.6 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0 }}>🌱 안녕, {membership.display_name}!</h1>
        <form action={logout}>
          <button type="submit" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>로그아웃</button>
        </form>
      </header>

      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        {week === 0 ? '아직 첫 주가 시작 안 됐어요. 다음 월요일부터 시작!' : `이번 주는 ${week}주차에요.`}
      </p>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '2rem' }}>
        <div style={{ padding: '16px', backgroundColor: '#fff8dc', borderRadius: '8px', border: '2px solid #f5c518' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>👛 자유 영역</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{fmt(free)}</div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>마음껏 쓸 수 있어요</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#e8f5e9', borderRadius: '8px', border: '2px solid #4caf50' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>🌳 실험 영역</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{fmt(exp)}</div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>매주 10% 자라요</div>
        </div>
        <div style={{ padding: '16px', backgroundColor: '#e3f2fd', borderRadius: '8px', border: '2px solid #2196f3' }}>
          <div style={{ fontSize: '0.85rem', color: '#666' }}>💧 보너스</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{fmt(bonus)}</div>
          <div style={{ fontSize: '0.75rem', color: '#888', marginTop: '4px' }}>부모님 매칭</div>
        </div>
      </section>

      <section style={{ padding: '20px', backgroundColor: '#f9f9f9', borderRadius: '8px', marginBottom: '1.5rem' }}>
        <h2 style={{ marginTop: 0 }}>이번 주 청구</h2>
        {canClaimNow ? (
          <a
            href="/claim"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#16a34a',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontSize: '1.1rem',
            }}
          >
            ✨ 산수 풀고 이자 받기
          </a>
        ) : (
          <p>{lastClaimed === week ? '이번 주는 이미 청구했어요! 다음 주에 다시 만나요 🌱' : '아직 청구할 수 있는 주가 안 됐어요.'}</p>
        )}
      </section>

      <section style={{ padding: '20px', backgroundColor: '#fff3e0', borderRadius: '8px' }}>
        <h2 style={{ marginTop: 0, fontSize: '1.1rem' }}>자유 → 실험으로 옮기기</h2>
        <p style={{ fontSize: '0.9rem', color: '#666' }}>
          실험 영역에 더 넣으면 더 많이 자라요. 단, 1주 동안은 못 빼요.
        </p>
        <form action={transferToExperiment} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="number"
            name="amount"
            min={100}
            max={free}
            step={100}
            placeholder="얼마?"
            required
            style={{ flex: 1, padding: '8px' }}
          />
          <SubmitButton variant="warn" pendingText="옮기는 중..." style={{ padding: '8px 16px' }}>
            옮기기
          </SubmitButton>
        </form>
      </section>

      <p style={{ marginTop: '2rem', textAlign: 'center', fontSize: '0.85rem', color: '#888' }}>
        <a href="/history">📊 내 잔액 변화 보기</a>
      </p>
    </main>
  );
}
