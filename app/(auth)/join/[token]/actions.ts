'use server';

import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { getSupabaseServerClient } from '@/lib/db/client';
import { logger, generateRequestId } from '@/lib/observability/logger';

function randomSuffix(len = 8): string {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < len; i += 1) s += a[Math.floor(Math.random() * a.length)];
  return s;
}

function asciiSlug(s: string): string {
  return s.replace(/[^A-Za-z0-9]/g, '').slice(0, 12) || 'kid';
}

export async function claimKidLogin(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const token = String(formData.get('token') ?? '').trim();
  const loginId = String(formData.get('loginId') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!token) redirect('/login?error=' + encodeURIComponent('잘못된 링크에요'));
  if (loginId.length < 1 || loginId.length > 20) {
    redirect(`/join/${token}?error=` + encodeURIComponent('아이디는 1-20자로 만들어주세요'));
  }
  if (password.length < 4 || password.length > 8) {
    redirect(`/join/${token}?error=` + encodeURIComponent('비밀번호는 4-8자로 만들어주세요'));
  }

  const admin = getSupabaseAdmin();

  // Pre-check: token still valid?
  const { data: m } = await admin
    .from('memberships')
    .select('id, display_name, user_id')
    .eq('invite_token', token)
    .eq('role', 'kid')
    .single();
  if (!m) {
    redirect('/login?error=' + encodeURIComponent('만료됐거나 잘못된 링크에요. 보호자에게 다시 받아주세요.'));
  }
  const kid = m as { id: string; display_name: string; user_id: string | null };
  if (kid.user_id) {
    redirect('/login?error=' + encodeURIComponent('이미 로그인 정보를 만들었어요. 로그인 페이지에서 들어와주세요.'));
  }

  // Pre-check: login_id available globally
  const { data: existing } = await admin
    .from('memberships')
    .select('id')
    .eq('role', 'kid')
    .eq('login_id', loginId);
  if (existing && existing.length > 0) {
    redirect(`/join/${token}?error=` + encodeURIComponent(`'${loginId}' 는 이미 다른 친구가 쓰고 있어요. 다른 아이디로 만들어주세요.`));
  }

  // Create auth user. Internal email is constructed so multiple identical
  // login_ids could exist if needed, but we guard with the unique index above.
  const internalEmail = `${asciiSlug(loginId)}_${randomSuffix()}@kids.moneybean`;
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { role: 'kid', display_name: kid.display_name, login_id: loginId },
  });
  if (authErr || !authUser.user) {
    logger.error('claimKidLogin: auth create failed', { request_id: reqId, error_code: authErr?.message });
    redirect(`/join/${token}?error=` + encodeURIComponent('계정 생성 실패: ' + (authErr?.message ?? '')));
  }

  const { data: claim, error: rpcErr } = await admin.rpc('claim_kid_login', {
    p_invite_token: token,
    p_kid_user_id: authUser.user.id,
    p_login_id: loginId,
  });
  if (rpcErr) {
    await admin.auth.admin.deleteUser(authUser.user.id).catch(() => {});
    logger.error('claimKidLogin: rpc error', { request_id: reqId, error_code: rpcErr.message });
    redirect(`/join/${token}?error=` + encodeURIComponent(rpcErr.message));
  }
  const result = claim as { ok: boolean; reason?: string };
  if (!result.ok) {
    await admin.auth.admin.deleteUser(authUser.user.id).catch(() => {});
    redirect(`/join/${token}?error=` + encodeURIComponent(result.reason ?? '실패'));
  }

  logger.info('claimKidLogin: ok', { request_id: reqId, action: 'claimKidLogin', success: true });

  // Auto sign-in
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signInWithPassword({ email: internalEmail, password });
  redirect('/onboarding');
}
