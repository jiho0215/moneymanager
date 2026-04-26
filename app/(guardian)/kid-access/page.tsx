import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { getSupabaseServerClient } from '@/lib/db/client';
import { issueKidCode } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

export const dynamic = 'force-dynamic';

export default async function KidAccessPage({ searchParams }: { searchParams: Promise<{ new_code?: string; expires?: string }> }) {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');
  const sp = await searchParams;

  const supabase = await getSupabaseServerClient();
  const kidIds = ctx.kids.map((k) => (k as { id: string }).id);
  const { data: codes } = await supabase
    .from('kid_login_codes')
    .select('*')
    .in('kid_membership_id', kidIds)
    .order('created_at', { ascending: false })
    .limit(20);

  const rows = (codes ?? []) as Array<{
    code: string; expires_at: string; used_at: string | null; created_at: string; kid_membership_id: string;
  }>;

  return (
    <main className="page">
      <h1 className="h1" style={{ marginBottom: 'var(--sp-2)' }}>🔑 자녀 로그인 코드</h1>
      <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
        코드는 24시간 동안 유효하며 한 번만 사용 가능합니다.
      </p>

      {sp.new_code && (
        <div className="alert alert-success fade-in" style={{ marginBottom: 'var(--sp-5)', flexDirection: 'column' }}>
          <div className="row gap-2"><span style={{ fontSize: '1.2rem' }}>✨</span><strong>새 코드 발급 완료</strong></div>
          <div style={{
            fontSize: '2.5rem', fontWeight: 800, textAlign: 'center', letterSpacing: '0.4em',
            margin: 'var(--sp-3) 0', color: 'var(--experiment-deep)', fontFamily: 'monospace',
            padding: 'var(--sp-4)', background: 'white', borderRadius: 'var(--r-md)',
          }}>
            {sp.new_code}
          </div>
          <p className="soft" style={{ textAlign: 'center', margin: 0 }}>
            자녀에게 이 코드를 알려주세요. 만료: {sp.expires}
          </p>
        </div>
      )}

      <div className="stack-4" style={{ marginBottom: 'var(--sp-5)' }}>
        {ctx.kids.map((k) => {
          const kid = k as { id: string; display_name: string };
          return (
            <section key={kid.id} className="card row-between">
              <h2 className="h3" style={{ margin: 0 }}>🌱 {kid.display_name}</h2>
              <form action={issueKidCode}>
                <input type="hidden" name="kidMembershipId" value={kid.id} />
                <SubmitButton variant="success" pendingText="발급 중...">
                  새 코드 발급
                </SubmitButton>
              </form>
            </section>
          );
        })}
      </div>

      <h2 className="h2" style={{ marginBottom: 'var(--sp-3)' }}>최근 코드</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="data">
          <thead>
            <tr>
              <th>코드</th>
              <th>만료</th>
              <th>상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={3} style={{ padding: 'var(--sp-5)', textAlign: 'center' }} className="muted">아직 발급한 코드가 없어요.</td></tr>
            )}
            {rows.map((r) => {
              const used = !!r.used_at;
              const expired = new Date(r.expires_at) < new Date();
              const status = used ? '사용됨' : expired ? '만료' : '활성';
              const badge = used ? 'badge-muted' : expired ? 'badge-warn' : 'badge-success';
              return (
                <tr key={r.code}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.1em' }}>{r.code}</td>
                  <td className="muted">{new Date(r.expires_at).toLocaleString('ko-KR')}</td>
                  <td><span className={`badge ${badge}`}>{status}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p style={{ marginTop: 'var(--sp-5)', textAlign: 'center' }}><Link href="/guardian">← 대시보드로</Link></p>
    </main>
  );
}
