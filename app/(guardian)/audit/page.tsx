import { getGuardianFamilyView } from '@/lib/db/queries';
import { getSupabaseServerClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString('ko-KR') + '원'; }

export default async function AuditPage() {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');

  const supabase = await getSupabaseServerClient();
  const accountIds = (ctx.accounts as Array<{ id: string }>).map((a) => a.id);

  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .in('account_id', accountIds)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: attempts } = await supabase
    .from('claim_attempts')
    .select('*')
    .in('account_id', accountIds)
    .order('attempted_at', { ascending: false })
    .limit(50);

  const txRows = (txs ?? []) as Array<{
    id: string; created_at: string; transaction_type: string; zone: string; amount: number; week_num: number | null;
  }>;
  const attemptRows = (attempts ?? []) as Array<{
    id: string; attempted_at: string; week_num: number; problem_id: string; user_answer: string | null; is_correct: boolean | null; attempt_number_this_week: number;
  }>;

  return (
    <main style={{ maxWidth: '900px', margin: '0 auto', padding: '24px' }}>
      <h1>📋 활동 기록</h1>

      <h2>최근 거래 (100개)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem', marginBottom: '2rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '6px', textAlign: 'left' }}>시각</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>유형</th>
            <th style={{ padding: '6px', textAlign: 'left' }}>영역</th>
            <th style={{ padding: '6px', textAlign: 'right' }}>금액</th>
            <th style={{ padding: '6px', textAlign: 'right' }}>주</th>
          </tr>
        </thead>
        <tbody>
          {txRows.map((t) => (
            <tr key={t.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px' }}>{new Date(t.created_at).toLocaleString('ko-KR')}</td>
              <td style={{ padding: '6px' }}>{t.transaction_type}</td>
              <td style={{ padding: '6px' }}>{t.zone}</td>
              <td style={{ padding: '6px', textAlign: 'right', color: Number(t.amount) < 0 ? '#dc2626' : '#16a34a' }}>
                {Number(t.amount) > 0 ? '+' : ''}{fmt(Number(t.amount))}
              </td>
              <td style={{ padding: '6px', textAlign: 'right' }}>{t.week_num ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>최근 청구 시도 (50개)</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '6px', textAlign: 'left' }}>시각</th>
            <th style={{ padding: '6px', textAlign: 'right' }}>주</th>
            <th style={{ padding: '6px', textAlign: 'right' }}>시도#</th>
            <th style={{ padding: '6px' }}>답</th>
            <th style={{ padding: '6px' }}>결과</th>
          </tr>
        </thead>
        <tbody>
          {attemptRows.map((a) => (
            <tr key={a.id} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px' }}>{new Date(a.attempted_at).toLocaleString('ko-KR')}</td>
              <td style={{ padding: '6px', textAlign: 'right' }}>{a.week_num}</td>
              <td style={{ padding: '6px', textAlign: 'right' }}>{a.attempt_number_this_week}/5</td>
              <td style={{ padding: '6px' }}>{a.user_answer ?? '—'}</td>
              <td style={{ padding: '6px' }}>{a.is_correct ? '✅ 정답' : '❌'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: '2rem', textAlign: 'center' }}><a href="/guardian">← 대시보드로</a></p>
    </main>
  );
}
