'use client';

import { useEffect } from 'react';
import { saveKidNames } from './kid-names-form';

/**
 * Silent client effect: when this component mounts (kid is on dashboard),
 * save the (kidNickname, guardianName) pair to localStorage so future
 * logins on this device show a one-click chip.
 */
export function RememberKidOnMount({
  nickname,
  guardianName,
}: {
  nickname: string;
  guardianName: string;
}) {
  useEffect(() => {
    if (nickname && guardianName) {
      saveKidNames(nickname, guardianName);
    }
  }, [nickname, guardianName]);
  return null;
}
