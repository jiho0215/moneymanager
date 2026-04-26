import Link from 'next/link';
import { loginGuardian, loginAsKidWithCode } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  return (
    <main style={{ maxWidth: '460px', margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>로그인</h1>

      {sp.error && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fca5a5',
            borderRadius: '6px',
            color: '#991b1b',
            marginBottom: '1rem',
          }}
        >
          ⚠️ {decodeURIComponent(sp.error)}
        </div>
      )}

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>👨‍👩‍👧 보호자</h2>
        <form action={loginGuardian} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input type="email" name="email" placeholder="이메일" required style={{ padding: '10px' }} />
          <input type="password" name="password" placeholder="비밀번호" required style={{ padding: '10px' }} />
          <SubmitButton variant="primary" pendingText="로그인 중..." style={{ padding: '10px' }}>
            로그인
          </SubmitButton>
        </form>
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>🌱 자녀 (코드)</h2>
        <p style={{ color: '#666', fontSize: '0.9rem', marginBottom: '0.5rem' }}>
          보호자가 발급한 6자 코드를 입력해주세요.
        </p>
        <form action={loginAsKidWithCode} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input
            type="text"
            name="code"
            placeholder="ABCDEF"
            maxLength={6}
            minLength={6}
            required
            style={{ padding: '10px', textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '1.2rem', textAlign: 'center' }}
          />
          <SubmitButton variant="success" pendingText="확인 중..." style={{ padding: '10px' }}>
            들어가기
          </SubmitButton>
        </form>
      </section>

      <p style={{ marginTop: '2rem', textAlign: 'center' }}>
        <Link href="/signup">처음이신가요? 가족 가입</Link>
      </p>
    </main>
  );
}
