import { redirect } from 'next/navigation';
import { getMyKidAccount } from '@/lib/db/queries';
import { getSupabaseServerClient } from '@/lib/db/client';
import { GrowthChart } from '@/lib/ui/chart';
import { buildHistorySeries } from '@/lib/db/history';
import type { WeeklySnapshotRow } from '@/lib/db/history';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString('ko-KR') + '원'; }

export default async function KidHistoryPage() {
  const ctx = await getMyKidAccount();
  if (!ctx) redirect('/login');

  const supabase = await getSupabaseServerClient();
  const { data: snapshots } = await supabase
    .from('weekly_snapshots')
    .select('*')
    .eq('account_id', String(ctx.account.id))
    .eq('cycle_number', Number(ctx.account.cycle_number))
    .order('week_num', { ascending: true });

  const rows = (snapshots ?? []) as WeeklySnapshotRow[];
  const series = buildHistorySeries({
    snapshots: rows,
    weeklyGrowthRateBp: Number(ctx.account.weekly_growth_rate_bp ?? 1000),
  });

  return (
    <main className="page">
      <h1 className="h1" style={{ marginBottom: 'var(--sp-2)' }}>📊 내 통장이 자라는 곡선</h1>
      <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
        통장 잔액이 매주 어떻게 자라는지 보여주는 그래프에요.
        <strong style={{ color: 'var(--experiment-deep)' }}> 점선</strong>은 매주 청구했다면의 곡선,
        <strong> 실선</strong>은 실제 곡선이에요.
      </p>

      <div className="card" style={{ marginBottom: 'var(--sp-5)' }}>
        <GrowthChart points={series} />
      </div>

      <h2 className="h2" style={{ marginBottom: 'var(--sp-3)' }}>주차별 자세히</h2>
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table className="data">
          <thead>
            <tr>
              <th>주</th>
              <th className="num">저금</th>
              <th className="num">이자</th>
              <th className="num">합계</th>
              <th>청구</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5} style={{ padding: 'var(--sp-5)', textAlign: 'center' }} className="muted">첫 청구 후 데이터가 나타나요.</td></tr>
            )}
            {rows.map((r) => {
              const principal = Number(r.free_balance);
              const interest = Number(r.experiment_balance) + Number(r.bonus_balance);
              return (
                <tr key={r.week_num}>
                  <td><strong>{r.week_num}주</strong></td>
                  <td className="num">{fmt(principal)}</td>
                  <td className="num" style={{ color: 'var(--experiment-deep)', fontWeight: 600 }}>
                    {interest > 0 ? '+' : ''}{fmt(interest)}
                  </td>
                  <td className="num"><strong>{fmt(principal + interest)}</strong></td>
                  <td>
                    {r.was_claimed_this_week
                      ? <span className="badge badge-success">✅ 청구함</span>
                      : <span className="badge badge-muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
