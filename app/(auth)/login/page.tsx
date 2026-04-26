import { loginGuardian, loginAsKidWithCode } from './actions';

export default function LoginPage() {
  return (
    <main style={{ maxWidth: '460px', margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem' }}>로그인</h1>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>👨‍👩‍👧 보호자</h2>
        <form action={loginGuardian} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <input type="email" name="email" placeholder="이메일" required style={{ padding: '10px' }} />
          <input type="password" name="password" placeholder="비밀번호" required style={{ padding: '10px' }} />
          <button
            type="submit"
            style={{ padding: '10px', backgroundColor: '#2563eb', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            로그인
          </button>
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
          <button
            type="submit"
            style={{ padding: '10px', backgroundColor: '#16a34a', color: 'white', border: 'none', borderRadius: '4px' }}
          >
            들어가기
          </button>
        </form>
      </section>

      <p style={{ marginTop: '2rem', textAlign: 'center' }}>
        <a href="/signup">처음이신가요? 가족 가입</a>
      </p>
    </main>
  );
}
