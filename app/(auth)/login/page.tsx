import Link from 'next/link';
import { loginGuardian } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';
import { KidNamesForm } from '@/lib/ui/kid-names-form';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;

  return (
    <main className="page page-narrow">
      <h1 className="h1" style={{ marginBottom: 'var(--sp-5)' }}>로그인</h1>

      {errorMsg && (
        <div className="alert alert-error fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>{errorMsg}</div>
        </div>
      )}

      <section className="card stack-3" style={{ marginBottom: 'var(--sp-4)' }}>
        <h2 className="h3">👨‍👩‍👧 보호자</h2>
        <form action={loginGuardian} className="stack-2">
          <input type="email" name="email" placeholder="이메일" required />
          <input type="password" name="password" placeholder="비밀번호" required />
          <SubmitButton variant="primary" pendingText="로그인 중...">
            로그인
          </SubmitButton>
        </form>
      </section>

      <section className="card stack-3">
        <h2 className="h3">🌱 자녀</h2>
        <p className="soft" style={{ margin: 0 }}>
          자녀 닉네임과 부모님 이름을 입력해주세요.
        </p>
        <KidNamesForm />
      </section>

      <p style={{ marginTop: 'var(--sp-5)', textAlign: 'center' }}>
        <Link href="/signup">처음이신가요? 가족 가입하기 →</Link>
      </p>
    </main>
  );
}
