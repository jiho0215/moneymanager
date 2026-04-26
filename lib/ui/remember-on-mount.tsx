'use client';

import { useEffect } from 'react';
import { saveKidNickname } from './kid-pin-form';

/**
 * Silent client effect: when this component mounts (kid is on dashboard),
 * save the (nickname, guardianName) to localStorage so future logins on
 * this device show a chip with friendly label.
 */
export function RememberKidOnMount({
  nickname,
  guardianName,
}: {
  nickname: string;
  guardianName: string;
}) {
  useEffect(() => {
    if (nickname) {
      saveKidNickname(nickname, guardianName);
    }
  }, [nickname, guardianName]);
  return null;
}
