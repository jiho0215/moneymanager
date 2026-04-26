import { signupFamily } from './actions';

const PIPA_TEXT = `[개인정보 수집 및 이용 동의 — 만 14세 미만 자녀]

본인은 자녀의 법정대리인으로서 다음 사항에 동의합니다:
1. 수집 항목: 자녀의 닉네임, 학년, 잔액 데이터
2. 이용 목적: 가족 내 복리 학습 경험 제공
3. 보유 기간: 가족 탈퇴 시점부터 30일 후 cascade 삭제
4. 자녀의 직접 가입 없이 본인이 대리 등록함
5. 자녀가 만 19세 도달 시 데이터 export 권리 보장

본 동의는 PIPA Article 22 에 따른 명시적 법정대리인 동의입니다.`;

function ErrorAlert({ message, showLoginLink }: { message: string; showLoginLink: boolean }) {
  return (
    <div
      role="alert"
      style={{
        padding: '14px 18px',
        backgroundColor: '#fee2e2',
        border: '2px solid #ef4444',
        borderRadius: '8px',
        color: '#991b1b',
        marginBottom: '1rem',
        fontWeight: 500,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
        <span style={{ fontSize: '1.2rem' }}>⚠️</span>
        <div style={{ flex: 1 }}>
          <div>{message}</div>
          {showLoginLink && (
            <a
              href="/login"
              style={{
                display: 'inline-block',
                marginTop: '8px',
                padding: '6px 14px',
                backgroundColor: '#991b1b',
                color: 'white',
                textDecoration: 'none',
                borderRadius: '4px',
                fontSize: '0.9rem',
              }}
            >
              로그인 페이지로 이동 →
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const showLoginLink = errorMsg?.includes('이미 가입된') ?? false;

  return (
    <main style={{ maxWidth: '560px', margin: '0 auto', padding: '40px 24px' }}>
      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🌱 가족 가입</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>보호자가 자녀 계정을 함께 생성합니다.</p>

      {errorMsg && <ErrorAlert message={errorMsg} showLoginLink={showLoginLink} />}

      <form action={signupFamily} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <fieldset style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
          <legend style={{ padding: '0 8px', fontWeight: 'bold' }}>보호자 정보</legend>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            이메일 *
            <input type="email" name="guardianEmail" required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            비밀번호 (8자 이상) *
            <input type="password" name="guardianPassword" minLength={8} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </label>
          <label style={{ display: 'block' }}>
            보호자 표시명 (선택)
            <input type="text" name="guardianDisplayName" style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </label>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
          <legend style={{ padding: '0 8px', fontWeight: 'bold' }}>가족 + 자녀</legend>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            가족 이름 *
            <input type="text" name="familyName" required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            자녀 닉네임 *
            <input type="text" name="kidNickname" required maxLength={20} style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </label>
          <label style={{ display: 'block', marginBottom: '0.5rem' }}>
            자녀 학년 (5 또는 6) *
            <select name="kidGrade" required style={{ width: '100%', padding: '8px', marginTop: '4px' }}>
              <option value="5">5학년</option>
              <option value="6">6학년</option>
            </select>
          </label>
          <label style={{ display: 'block' }}>
            시작 자금 (KRW, 추천 10,000원) *
            <input type="number" name="startingCapital" defaultValue={10000} min={1000} max={1000000} step={1000} required style={{ width: '100%', padding: '8px', marginTop: '4px' }} />
          </label>
        </fieldset>

        <fieldset style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
          <legend style={{ padding: '0 8px', fontWeight: 'bold' }}>법정대리인 동의 (PIPA) *</legend>
          <pre
            style={{
              fontSize: '0.85rem',
              whiteSpace: 'pre-wrap',
              backgroundColor: '#f7f7f7',
              padding: '12px',
              borderRadius: '4px',
              maxHeight: '200px',
              overflow: 'auto',
            }}
          >
            {PIPA_TEXT}
          </pre>
          <label style={{ display: 'block', marginTop: '0.5rem' }}>
            <input type="checkbox" name="consent" required /> 위 내용에 동의합니다. *
          </label>
        </fieldset>

        {/* Error also shown right above the submit button so it's visible regardless of scroll */}
        {errorMsg && <ErrorAlert message={errorMsg} showLoginLink={showLoginLink} />}

        <button
          type="submit"
          style={{
            padding: '12px',
            backgroundColor: '#2563eb',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '1rem',
            cursor: 'pointer',
          }}
        >
          가족 만들기
        </button>
      </form>

      <p style={{ marginTop: '1rem', textAlign: 'center', color: '#666' }}>
        이미 계정이 있으신가요? <a href="/login">로그인</a>
      </p>
    </main>
  );
}
