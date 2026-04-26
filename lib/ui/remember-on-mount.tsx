'use client';

import { useEffect } from 'react';
import { saveKidCode } from './kid-code-form';

/**
 * Silent client effect: when this component mounts (i.e. kid is on dashboard),
 * pair the kid's code with their nickname AND the guardian's name so future
 * logins on this device show a chip like '쥐호 넘버2 — 쥐호 가족'.
 * The guardian name disambiguates same-nickname kids across families on a
 * shared device.
 */
export function RememberKidOnMount({
  code,
  nickname,
  guardianName,
}: {
  code: string | null;
  nickname: string;
  guardianName: string;
}) {
  useEffect(() => {
    if (code && /^[A-Z0-9]{6}$/.test(code)) {
      saveKidCode(code, nickname, guardianName);
    }
  }, [code, nickname, guardianName]);
  return null;
}
