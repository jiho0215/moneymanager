import { getMyKidAccount } from '@/lib/db/queries';
import { getSupabaseServerClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';
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
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <h1>📊 내 잔액이 자라는 곡선</h1>
      <p style={{ color: '#666' }}>실험 영역의 잔액이 매주 어떻게 자라는지 보여주는 그래프에요.</p>

      <div style={{ marginTop: '1.5rem', padding: '16px', backgroundColor: '#f9f9f9', borderRadius: '8px' }}>
        <GrowthChart points={series} />
      </div>

      <h2 style={{ marginTop: '2rem' }}>주차별 자세히</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>주</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>자유</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>실험</th>
            <th style={{ padding: '8px', textAlign: 'right' }}>보너스</th>
            <th style={{ padding: '8px', textAlign: 'center' }}>청구</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.week_num} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px' }}>{r.week_num}주</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(Number(r.free_balance))}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(Number(r.experiment_balance))}</td>
              <td style={{ padding: '8px', textAlign: 'right' }}>{fmt(Number(r.bonus_balance))}</td>
              <td style={{ padding: '8px', textAlign: 'center' }}>{r.was_claimed_this_week ? '✅' : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a href="/dashboard">← 대시보드로</a>
      </p>
    </main>
  );
}
