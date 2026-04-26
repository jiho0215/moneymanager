import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { rotateKidCode } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

export const dynamic = 'force-dynamic';

export default async function KidAccessPage({ searchParams }: { searchParams: Promise<{ rotated?: string; error?: string }> }) {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');
  const sp = await searchParams;

  return (
    <main className="page">
      <h1 className="h1" style={{ marginBottom: 'var(--sp-2)' }}>🔑 자녀 로그인 코드</h1>
      <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
        한 번 알려주면 자녀가 매번 같은 코드로 로그인할 수 있어요. 분실 시 회전 버튼.
      </p>

      {sp.error && (
        <div className="alert alert-error fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>{decodeURIComponent(sp.error)}</div>
        </div>
      )}
      {sp.rotated && (
        <div className="alert alert-success fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>🔄</span>
          <div>새 코드 발급됨: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.2em' }}>{sp.rotated}</strong>. 이전 코드는 더 이상 안 됨.</div>
        </div>
      )}

      <div className="stack-4">
        {(ctx.kids as Array<{ id: string; display_name: string; access_code: string | null }>).map((kid) => (
          <section key={kid.id} className="card stack-4">
            <div className="row-between">
              <h2 className="h2">🌱 {kid.display_name}</h2>
              <span className="badge badge-success">활성</span>
            </div>

            <div
              style={{
                background: 'linear-gradient(135deg, #ecfdf5 0%, #fef3c7 100%)',
                border: '2px solid var(--experiment)',
                borderRadius: 'var(--r-lg)',
                padding: 'var(--sp-5) var(--sp-4)',
                textAlign: 'center',
              }}
            >
              <div className="label" style={{ color: 'var(--experiment-deep)', marginBottom: 8 }}>로그인 코드</div>
              <div
                style={{
                  fontSize: '3rem',
                  fontWeight: 800,
                  letterSpacing: '0.4em',
                  fontFamily: 'monospace',
                  color: 'var(--experiment-deep)',
                  paddingLeft: '0.4em', // compensate for letter-spacing offset
                }}
              >
                {kid.access_code ?? '—'}
              </div>
              <div className="soft" style={{ marginTop: 8 }}>
                자녀에게 이 6자만 알려주면 끝. 영구적으로 사용 가능.
              </div>
            </div>

            <details>
              <summary style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                🔄 코드 회전 (분실/유출 시)
              </summary>
              <div style={{ marginTop: 'var(--sp-3)', padding: 'var(--sp-3)', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}>
                <p className="soft" style={{ margin: '0 0 var(--sp-3)' }}>
                  새 코드 발급. 기존 코드는 즉시 사용 불가.
                </p>
                <form action={rotateKidCode}>
                  <input type="hidden" name="kidMembershipId" value={kid.id} />
                  <SubmitButton variant="warn" pendingText="회전 중...">
                    새 코드 발급
                  </SubmitButton>
                </form>
              </div>
            </details>
          </section>
        ))}
      </div>

      <div className="card" style={{ marginTop: 'var(--sp-5)', background: 'var(--bonus-bg)', borderColor: 'var(--bonus)' }}>
        <h3 className="h3" style={{ marginBottom: 'var(--sp-2)', color: 'var(--bonus-deep)' }}>💡 어떻게 쓰는 거예요?</h3>
        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.92rem', lineHeight: 1.7, color: 'var(--text)' }}>
          <li>자녀에게 6자 코드만 알려주세요 (말로, 종이에 적어, 또는 메시지로).</li>
          <li>자녀는 [/login] 페이지에서 코드 입력 → 자녀 dashboard 진입.</li>
          <li>코드는 영구적이라 매번 발급할 필요 없어요.</li>
          <li>혹시 다른 사람이 알게 됐다면 &lsquo;코드 회전&rsquo;으로 새 코드 발급.</li>
        </ul>
      </div>

    </main>
  );
}
