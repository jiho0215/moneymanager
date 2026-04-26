import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { SubmitButton } from '@/lib/ui/submit-button';
import { claimKidLogin } from './actions';

export const dynamic = 'force-dynamic';

export default async function JoinPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  const admin = getSupabaseAdmin();
  const { data: m } = await admin
    .from('memberships')
    .select('id, display_name, family_id, user_id')
    .eq('invite_token', token)
    .eq('role', 'kid')
    .single();

  if (!m) {
    return (
      <main className="page page-narrow">
        <h1 className="h1">⚠️ 잘못된 링크</h1>
        <p className="muted">
          이 링크는 만료됐거나 사용된 적이 있어요. 보호자에게 새 링크를 받아주세요.
        </p>
      </main>
    );
  }
  const kid = m as { id: string; display_name: string; family_id: string; user_id: string | null };
  if (kid.user_id) {
    redirect('/login?error=' + encodeURIComponent('이미 로그인 정보를 만들었어요. 로그인 페이지에서 들어가주세요.'));
  }

  const { data: fam } = await admin
    .from('families')
    .select('name')
    .eq('id', kid.family_id)
    .single();
  const familyName = (fam as { name: string } | null)?.name ?? '';

  return (
    <main className="page page-narrow">
      <header style={{ textAlign: 'center', marginBottom: 'var(--sp-5)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 'var(--sp-2)' }}>🌱</div>
        <h1 className="h1" style={{ margin: 0 }}>
          {kid.display_name}, 환영해요!
        </h1>
        <p className="soft" style={{ margin: '4px 0 0' }}>{familyName} 가족 통장 만들기</p>
      </header>

      {errorMsg && (
        <div className="alert alert-error fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>{errorMsg}</div>
        </div>
      )}

      <section className="card stack-4">
        <p className="muted" style={{ margin: 0 }}>
          로그인할 때 쓸 <strong>아이디</strong>와 <strong>비밀번호</strong>를 만들어요.
          <br />
          한 번 만들면 다음부터 이걸로 로그인해요.
        </p>

        <form action={claimKidLogin} className="stack-3">
          <input type="hidden" name="token" value={token} />

          <label className="field" style={{ margin: 0 }}>
            아이디 <span className="soft" style={{ fontWeight: 400 }}>(한글/영문/숫자, 1-20자)</span>
            <input
              type="text"
              name="loginId"
              required
              minLength={1}
              maxLength={20}
              placeholder="예: 지호, jiho, 지호1"
              autoComplete="off"
            />
          </label>

          <label className="field" style={{ margin: 0 }}>
            비밀번호 <span className="soft" style={{ fontWeight: 400 }}>(4-8자, 자유)</span>
            <input
              type="password"
              name="password"
              required
              minLength={4}
              maxLength={8}
              placeholder="기억하기 쉬운 거"
              autoComplete="new-password"
            />
          </label>

          <SubmitButton variant="success" pendingText="만드는 중...">
            🚀 통장 들어가기
          </SubmitButton>
        </form>
      </section>

      <p className="muted" style={{ textAlign: 'center', fontSize: '0.85rem', marginTop: 'var(--sp-4)' }}>
        이 페이지는 한 번만 쓰는 링크에요. 통장에 들어간 후로는 로그인 페이지에서 들어와요.
      </p>
    </main>
  );
}
