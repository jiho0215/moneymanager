import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { getSupabaseServerClient } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString('ko-KR') + '원'; }

const TX_LABEL: Record<string, string> = {
  initial_deposit: '시작 자금',
  free_withdraw: '자유 인출',
  free_to_experiment: '자유 → 실험',
  experiment_to_free: '실험 → 자유',
  interest_accrued: '이자 누적',
  interest_claimed: '이자 청구',
  bonus_match: '보너스 매칭',
  bonus_match_revert: '보너스 취소',
  manual_adjustment: '수동 조정',
};

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
    <main className="page page-wide">
      <h1 className="h1" style={{ marginBottom: 'var(--sp-5)' }}>📋 활동 기록</h1>

      <h2 className="h2" style={{ marginBottom: 'var(--sp-3)' }}>최근 거래 <span className="soft">({txRows.length})</span></h2>
      <div className="card" style={{ padding: 0, overflow: 'auto', marginBottom: 'var(--sp-5)' }}>
        <table className="data">
          <thead>
            <tr>
              <th>시각</th>
              <th>유형</th>
              <th>영역</th>
              <th className="num">금액</th>
              <th className="num">주</th>
            </tr>
          </thead>
          <tbody>
            {txRows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 'var(--sp-5)', textAlign: 'center' }} className="muted">아직 거래가 없어요.</td></tr>
            )}
            {txRows.map((t) => (
              <tr key={t.id}>
                <td className="muted">{new Date(t.created_at).toLocaleString('ko-KR')}</td>
                <td>{TX_LABEL[t.transaction_type] ?? t.transaction_type}</td>
                <td>
                  <span className={`badge badge-${t.zone === 'free' ? 'warn' : t.zone === 'experiment' ? 'success' : 'info'}`}>
                    {t.zone === 'free' ? '자유' : t.zone === 'experiment' ? '실험' : '보너스'}
                  </span>
                </td>
                <td className="num" style={{ color: Number(t.amount) < 0 ? 'var(--danger)' : 'var(--experiment-deep)', fontWeight: 700 }}>
                  {Number(t.amount) > 0 ? '+' : ''}{fmt(Number(t.amount))}
                </td>
                <td className="num muted">{t.week_num ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="h2" style={{ marginBottom: 'var(--sp-3)' }}>최근 청구 시도 <span className="soft">({attemptRows.length})</span></h2>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              <th>시각</th>
              <th className="num">주</th>
              <th className="num">시도</th>
              <th>입력 답</th>
              <th>결과</th>
            </tr>
          </thead>
          <tbody>
            {attemptRows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 'var(--sp-5)', textAlign: 'center' }} className="muted">아직 청구 시도가 없어요.</td></tr>
            )}
            {attemptRows.map((a) => (
              <tr key={a.id}>
                <td className="muted">{new Date(a.attempted_at).toLocaleString('ko-KR')}</td>
                <td className="num">{a.week_num}</td>
                <td className="num">{a.attempt_number_this_week}/5</td>
                <td style={{ fontFamily: 'monospace' }}>{a.user_answer ?? '—'}</td>
                <td>
                  <span className={`badge ${a.is_correct ? 'badge-success' : 'badge-warn'}`}>
                    {a.is_correct ? '✅ 정답' : '❌ 오답'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </main>
  );
}
