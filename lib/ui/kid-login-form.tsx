'use client';

import { useEffect, useRef, useState } from 'react';
import { loginAsKid } from '@/app/(auth)/login/actions';
import { SubmitButton } from './submit-button';

const STORAGE_KEY = 'cls_kid_logins_v1';
const MAX_REMEMBERED = 6;

export type RememberedKid = {
  loginId: string;
  displayName?: string;
  familyName?: string;
  lastUsedAt: number;
};

export function loadRememberedKids(): RememberedKid[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((x) => typeof x?.loginId === 'string' && x.loginId.length > 0)
      .slice(0, MAX_REMEMBERED);
  } catch {
    return [];
  }
}

export function saveRememberedKid(entry: RememberedKid) {
  if (typeof window === 'undefined') return;
  const others = loadRememberedKids().filter((c) => c.loginId !== entry.loginId);
  const next = [{ ...entry, lastUsedAt: Date.now() }, ...others].slice(0, MAX_REMEMBERED);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function removeEntry(loginId: string) {
  if (typeof window === 'undefined') return;
  const next = loadRememberedKids().filter((c) => c.loginId !== loginId);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function KidLoginForm() {
  const [remembered, setRemembered] = useState<RememberedKid[]>([]);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const pwRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRemembered(loadRememberedKids());
  }, []);

  function handleChip(c: RememberedKid) {
    setLoginId(c.loginId);
    setRemember(true);
    setTimeout(() => pwRef.current?.focus(), 50);
  }

  function handleForget(c: RememberedKid) {
    removeEntry(c.loginId);
    setRemembered(loadRememberedKids());
  }

  function handleSubmit() {
    if (remember && loginId.trim() && password.length >= 4) {
      saveRememberedKid({ loginId: loginId.trim(), lastUsedAt: Date.now() });
    } else if (!remember) {
      removeEntry(loginId.trim());
    }
  }

  return (
    <div className="stack-3">
      {remembered.length > 0 && (
        <div>
          <div className="soft" style={{ marginBottom: 8 }}>📌 이 기기에서 로그인했던 자녀</div>
          <div className="stack-2">
            {remembered.map((c) => (
              <div
                key={c.loginId}
                className="row"
                style={{
                  background: 'var(--experiment-bg)',
                  border: '1px solid var(--experiment)',
                  borderRadius: 'var(--r-md)',
                  paddingRight: 4,
                  alignItems: 'stretch',
                }}
              >
                <button
                  type="button"
                  onClick={() => handleChip(c)}
                  className="row gap-3"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '12px 16px',
                    color: 'var(--experiment-deep)',
                    fontFamily: 'inherit',
                    alignItems: 'center',
                    flex: 1,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '1.4rem' }}>🌱</span>
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', display: 'block' }}>{c.loginId}</span>
                    {(c.displayName || c.familyName) && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                        {[c.displayName, c.familyName].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleForget(c)}
                  aria-label={`${c.loginId} 잊기`}
                  title="이 자녀 잊기"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: '0 12px',
                    fontSize: '0.95rem',
                    lineHeight: 1,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form action={loginAsKid} onSubmit={handleSubmit} className="stack-2">
        <label className="field" style={{ margin: 0 }}>
          아이디
          <input
            type="text"
            name="loginId"
            placeholder="예: 지호"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            required
            maxLength={20}
            autoComplete="username"
          />
        </label>
        <label className="field" style={{ margin: 0 }}>
          비밀번호
          <input
            ref={pwRef}
            type="password"
            name="password"
            placeholder="4-8자"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={4}
            maxLength={8}
            autoComplete="current-password"
          />
        </label>
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.88rem',
            color: 'var(--text-muted)',
            margin: 0,
          }}
        >
          <input
            type="checkbox"
            name="remember"
            value="on"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          이 기기 기억하기 <span className="soft" style={{ fontSize: '0.78rem' }}>(공용 PC면 체크 해제)</span>
        </label>
        {/* Send "off" instead of "on" when unchecked so the server sees something */}
        {!remember && <input type="hidden" name="remember" value="off" />}
        <SubmitButton variant="success" pendingText="확인 중...">
          들어가기
        </SubmitButton>
      </form>
    </div>
  );
}
