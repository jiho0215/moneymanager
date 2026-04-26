import Link from 'next/link';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { getSupabaseServerClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';
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
    code: string;
    expires_at: string;
    used_at: string | null;
    created_at: string;
    kid_membership_id: string;
  }>;

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <h1>🔑 자녀 로그인 코드</h1>
      <p style={{ color: '#666' }}>코드는 24시간 동안 유효하며 한 번만 사용 가능합니다.</p>

      {sp.new_code && (
        <div style={{ padding: '20px', backgroundColor: '#dcfce7', borderRadius: '8px', marginBottom: '1rem' }}>
          <p style={{ margin: 0, color: '#166534' }}>새 코드 발급됨:</p>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', textAlign: 'center', letterSpacing: '0.2em', marginTop: '8px' }}>
            {sp.new_code}
          </div>
          <p style={{ fontSize: '0.85rem', color: '#666', textAlign: 'center', margin: '8px 0 0' }}>
            자녀에게 이 코드를 알려주세요. 만료: {sp.expires}
          </p>
        </div>
      )}

      {ctx.kids.map((k) => {
        const kid = k as { id: string; display_name: string };
        return (
          <section key={kid.id} style={{ padding: '16px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '12px' }}>
            <h2 style={{ marginTop: 0 }}>{kid.display_name}</h2>
            <form action={issueKidCode}>
              <input type="hidden" name="kidMembershipId" value={kid.id} />
              <SubmitButton variant="success" pendingText="발급 중..." style={{ padding: '10px 20px' }}>
                새 코드 발급
              </SubmitButton>
            </form>
          </section>
        );
      })}

      <h2 style={{ marginTop: '2rem' }}>최근 코드</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ padding: '8px', textAlign: 'left' }}>코드</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>만료</th>
            <th style={{ padding: '8px', textAlign: 'left' }}>상태</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '8px', fontFamily: 'monospace' }}>{r.code}</td>
              <td style={{ padding: '8px' }}>{new Date(r.expires_at).toLocaleString('ko-KR')}</td>
              <td style={{ padding: '8px' }}>
                {r.used_at ? '사용됨' : new Date(r.expires_at) < new Date() ? '만료' : '활성'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: '2rem', textAlign: 'center' }}><Link href="/guardian">← 대시보드로</Link></p>
    </main>
  );
}
