'use client';

import { useEffect, useRef, useState } from 'react';
import { loginAsKidWithPin } from '@/app/(auth)/login/actions';
import { SubmitButton } from './submit-button';

const STORAGE_KEY = 'cls_kid_pins_v1';
const MAX_REMEMBERED = 6;

export type RememberedKid = {
  nickname: string;
  guardianName?: string;
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
      .filter((x) => typeof x?.nickname === 'string' && x.nickname.length > 0)
      .slice(0, MAX_REMEMBERED);
  } catch {
    return [];
  }
}

export function saveKidNickname(nickname: string, guardianName?: string) {
  if (typeof window === 'undefined') return;
  const n = nickname.trim();
  if (!n) return;
  const existing = loadRememberedKids();
  const others = existing.filter((c) => c.nickname !== n);
  const next = [{ nickname: n, guardianName, lastUsedAt: Date.now() }, ...others].slice(0, MAX_REMEMBERED);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function removeEntry(nickname: string) {
  if (typeof window === 'undefined') return;
  const next = loadRememberedKids().filter((c) => c.nickname !== nickname);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function KidPinForm() {
  const [remembered, setRemembered] = useState<RememberedKid[]>([]);
  const [kidNickname, setKidNickname] = useState('');
  const [kidPin, setKidPin] = useState('');
  const pinRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setRemembered(loadRememberedKids());
  }, []);

  function handleChip(c: RememberedKid) {
    setKidNickname(c.nickname);
    setTimeout(() => pinRef.current?.focus(), 50);
  }

  function handleForget(c: RememberedKid) {
    removeEntry(c.nickname);
    setRemembered(loadRememberedKids());
  }

  function handleSubmit() {
    if (kidNickname.trim() && /^\d{4}$/.test(kidPin)) {
      saveKidNickname(kidNickname);
    }
  }

  return (
    <div className="stack-3">
      {remembered.length > 0 && (
        <div>
          <div className="soft" style={{ marginBottom: 8 }}>📌 저장된 자녀 — 누르면 닉네임 자동 채움</div>
          <div className="stack-2">
            {remembered.map((c) => (
              <div
                key={c.nickname}
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
                    <span style={{ fontWeight: 700, fontSize: '1rem', display: 'block' }}>{c.nickname}</span>
                    {c.guardianName && (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'block', marginTop: 2 }}>
                        {c.guardianName} 가족
                      </span>
                    )}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleForget(c)}
                  aria-label={`${c.nickname} 잊기`}
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

      <form action={loginAsKidWithPin} onSubmit={handleSubmit} className="stack-2">
        <label className="field" style={{ margin: 0 }}>
          자녀 닉네임
          <input
            type="text"
            name="kidNickname"
            placeholder="예: 쥐호 넘버2"
            value={kidNickname}
            onChange={(e) => setKidNickname(e.target.value)}
            required
            autoComplete="off"
          />
        </label>
        <label className="field" style={{ margin: 0 }}>
          PIN (숫자 4자리)
          <input
            ref={pinRef}
            type="text"
            name="kidPin"
            placeholder="••••"
            value={kidPin}
            onChange={(e) => setKidPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            required
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            minLength={4}
            autoComplete="off"
            style={{
              fontFamily: 'monospace',
              letterSpacing: '0.6em',
              fontSize: '1.4rem',
              textAlign: 'center',
              paddingLeft: '0.6em',
            }}
          />
        </label>
        <SubmitButton variant="success" pendingText="확인 중...">
          들어가기
        </SubmitButton>
      </form>
    </div>
  );
}
