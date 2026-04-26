'use client';

import { useEffect } from 'react';
import { saveRememberedKid } from './kid-login-form';

/**
 * On the kid dashboard, write a friendly chip entry (loginId, displayName,
 * familyName) to localStorage so the next login on this device shows it.
 * The kid form's "remember me" checkbox controls whether anything was saved
 * on the previous login; this hook always refreshes it on dashboard visits.
 */
export function RememberKidOnMount({
  loginId,
  displayName,
  familyName,
}: {
  loginId: string;
  displayName: string;
  familyName: string;
}) {
  useEffect(() => {
    if (loginId) {
      saveRememberedKid({ loginId, displayName, familyName, lastUsedAt: Date.now() });
    }
  }, [loginId, displayName, familyName]);
  return null;
}
