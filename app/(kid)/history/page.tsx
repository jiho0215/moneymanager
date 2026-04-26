import { redirect } from 'next/navigation';
import { getMyKidAccount } from '@/lib/db/queries';
import { getSupabaseServerClient } from '@/lib/db/client';
import type { WeeklySnapshotRow } from '@/lib/db/history';

export const dynamic = 'force-dynamic';

function fmt(n: number) { return n.toLocaleString('ko-KR') + '원'; }

function fmtDate(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

type TxRow = {
  id: string;
  transaction_type: string;
  zone: string;
  amount: number;
  week_num: number | null;
  created_at: string;
};

type TxView = {
  id: string;
  date: string;
  icon: string;
  label: string;
  amount: number;
  weekNum: number | null;
  createdAt: string;
};

function classifyTx(t: TxRow): TxView | null {
  const amount = Number(t.amount);
  const base = { id: t.id, date: fmtDate(t.created_at), createdAt: t.created_at, weekNum: t.week_num };
  switch (t.transaction_type) {
    case 'initial_deposit':
      return { ...base, icon: '🌱', label: '저금 시작', amount };
    case 'manual_adjustment':
      return { ...base, icon: '📥', label: '저금 입금', amount };
    case 'interest_accrued':
      if (amount === 0) return null;
      return { ...base, icon: '📈', label: `${t.week_num}주차 이자`, amount };
    case 'bonus_match':
      return { ...base, icon: '💧', label: '보너스 (이전 모델)', amount };
    default:
      return null;
  }
}

// Legacy create_family_with_kid wrote two initial_deposit rows (free 80%, exp 20%)
// at the same timestamp. Merge any (label, createdAt) duplicates in display.
function mergeSimultaneous(views: TxView[]): TxView[] {
  const buckets = new Map<string, TxView>();
  const order: string[] = [];
  for (const v of views) {
    const key = `${v.label}|${v.createdAt}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.amount += v.amount;
    } else {
      buckets.set(key, { ...v });
      order.push(key);
    }
  }
  return order.map((k) => buckets.get(k)!);
}

export default async function KidHistoryPage() {
  const ctx = await getMyKidAccount();
  if (!ctx) redirect('/login');

  const supabase = await getSupabaseServerClient();
  const accountId = String(ctx.account.id);

  const [{ data: snapshots }, { data: txs }] = await Promise.all([
    supabase
      .from('weekly_snapshots')
      .select('*')
      .eq('account_id', accountId)
      .eq('cycle_number', Number(ctx.account.cycle_number))
      .order('week_num', { ascending: true }),
    supabase
      .from('transactions')
      .select('id, transaction_type, zone, amount, week_num, created_at')
      .eq('account_id', accountId)
      .order('created_at', { ascending: false }),
  ]);

  const rows = (snapshots ?? []) as WeeklySnapshotRow[];

  const txViews = mergeSimultaneous(
    ((txs ?? []) as TxRow[])
      .map(classifyTx)
      .filter((v): v is TxView => v !== null)
  );

  return (
    <main className="page">
      <h1 className="h1" style={{ marginBottom: 'var(--sp-5)' }}>📋 통장 기록</h1>

      <h2 className="h2" style={{ marginBottom: 'var(--sp-3)' }}>들어온 돈 히스토리</h2>
      <p className="muted" style={{ marginBottom: 'var(--sp-3)', fontSize: '0.9rem' }}>
        원금 (저금)과 이자가 언제, 얼마씩 들어왔는지 보여줘요. 최근부터.
      </p>
      <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--sp-5)' }}>
        {txViews.length === 0 ? (
          <div style={{ padding: 'var(--sp-5)', textAlign: 'center' }} className="muted">
            아직 들어온 돈이 없어요.
          </div>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
            {txViews.map((t) => (
              <li
                key={t.id}
                className="row gap-3"
                style={{
                  padding: 'var(--sp-3) var(--sp-4)',
                  borderBottom: '1px solid var(--border)',
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: '1.4rem' }}>{t.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{t.label}</div>
                  <div className="soft" style={{ fontSize: '0.82rem' }}>{t.date}</div>
                </div>
                <span
                  className="amount"
                  style={{ color: 'var(--experiment-deep)', fontWeight: 700 }}
                >
                  +{fmt(t.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
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
