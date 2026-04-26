import Link from 'next/link';
import { signupFamily } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

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
    <div className="alert alert-error fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
      <span style={{ fontSize: '1.2rem' }}>⚠️</span>
      <div style={{ flex: 1 }}>
        <div>{message}</div>
        {showLoginLink && (
          <Link
            href="/login"
            className="btn btn-primary"
            style={{ marginTop: 10, padding: '6px 14px', fontSize: '0.9rem' }}
          >
            로그인 페이지로 이동 →
          </Link>
        )}
      </div>
    </div>
  );
}

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const sp = await searchParams;
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null;
  const showLoginLink = errorMsg?.includes('이미 가입된') ?? false;

  return (
    <main className="page page-narrow">
      <h1 className="h1" style={{ marginBottom: 'var(--sp-2)' }}>🌱 가족 가입</h1>
      <p className="lead" style={{ marginBottom: 'var(--sp-5)' }}>
        보호자가 자녀 계정을 함께 생성합니다.
      </p>

      {errorMsg && <ErrorAlert message={errorMsg} showLoginLink={showLoginLink} />}

      <form action={signupFamily} className="stack-4">
        <fieldset className="stack-3">
          <legend>보호자 정보</legend>
          <label className="field">
            이메일 *
            <input type="email" name="guardianEmail" required />
          </label>
          <label className="field">
            비밀번호 (8자 이상) *
            <input type="password" name="guardianPassword" minLength={8} required />
          </label>
          <label className="field">
            보호자 표시명 (선택)
            <input type="text" name="guardianDisplayName" />
          </label>
        </fieldset>

        <fieldset className="stack-3">
          <legend>가족 + 자녀</legend>
          <label className="field">
            가족 이름 *
            <input type="text" name="familyName" required />
          </label>
          <label className="field">
            자녀 닉네임 * <span className="soft" style={{ fontWeight: 400 }}>(전체에서 유일해야 해요)</span>
            <input type="text" name="kidNickname" required maxLength={20} />
          </label>
          <label className="field">
            자녀 PIN * <span className="soft" style={{ fontWeight: 400 }}>(숫자 4자리)</span>
            <input
              type="text"
              name="kidPin"
              required
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              minLength={4}
              placeholder="1234"
              style={{ fontFamily: 'monospace', letterSpacing: '0.4em', fontSize: '1.1rem', textAlign: 'center' }}
            />
          </label>
          <label className="field">
            자녀 학년 (5 또는 6) *
            <select name="kidGrade" required>
              <option value="5">5학년</option>
              <option value="6">6학년</option>
            </select>
          </label>
          <p className="soft" style={{ margin: 0, fontSize: '0.85rem' }}>
            ✨ 시작 원금, 저금 방식, 기간은 가입 후 보호자가 직접 정해요.
          </p>
        </fieldset>

        <fieldset className="stack-3">
          <legend>법정대리인 동의 (PIPA) *</legend>
          <pre style={{
            fontSize: '0.85rem', whiteSpace: 'pre-wrap', background: 'var(--surface-2)',
            padding: 'var(--sp-3)', borderRadius: 'var(--r-sm)',
            maxHeight: '180px', overflow: 'auto', margin: 0,
          }}>
            {PIPA_TEXT}
          </pre>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.95rem' }}>
            <input type="checkbox" name="consent" required style={{ width: 18, height: 18 }} />
            위 내용에 동의합니다. *
          </label>
        </fieldset>

        {errorMsg && <ErrorAlert message={errorMsg} showLoginLink={showLoginLink} />}

        <SubmitButton variant="primary" pendingText="가족 만드는 중..." style={{ padding: '14px', fontSize: '1.05rem' }}>
          가족 만들기
        </SubmitButton>
      </form>

      <p style={{ marginTop: 'var(--sp-5)', textAlign: 'center' }} className="muted">
        이미 계정이 있으신가요? <Link href="/login">로그인</Link>
      </p>
    </main>
  );
}
