'use server';

import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/db/client';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { logger, generateRequestId } from '@/lib/observability/logger';

export async function loginGuardian(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) redirect('/login?error=' + encodeURIComponent('이메일/비밀번호 입력 필요'));

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect('/login?error=' + encodeURIComponent(error.message));

  redirect('/guardian');
}

export async function loginAsKidWithCode(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const code = String(formData.get('code') ?? '').trim().toUpperCase();
  if (code.length !== 6) {
    redirect('/login?error=' + encodeURIComponent('코드는 6자입니다.'));
  }

  const admin = getSupabaseAdmin();
  // Permanent code on memberships.access_code (post migration 016)
  const { data: memberships } = await admin
    .from('memberships')
    .select('id, user_id, role, family_id')
    .eq('access_code', code);
  const membership = memberships?.[0] as { id: string; user_id: string; role: string } | undefined;

  if (!membership || membership.role !== 'kid') {
    logger.warn('kid login: invalid code', { request_id: reqId, success: false });
    redirect('/login?error=' + encodeURIComponent('잘못된 코드입니다.'));
  }

  const { data: kidUser, error: uErr } = await admin.auth.admin.getUserById(membership!.user_id);
  if (uErr || !kidUser.user) redirect('/login?error=' + encodeURIComponent('자녀 인증 실패'));

  const kidEmail = kidUser.user!.email;
  const kidInternalPassword = (kidUser.user!.user_metadata as { internal_password?: string })?.internal_password;
  if (!kidEmail || !kidInternalPassword) redirect('/login?error=' + encodeURIComponent('자격증명 누락'));

  const supabase = await getSupabaseServerClient();
  const { error: signinErr } = await supabase.auth.signInWithPassword({
    email: kidEmail!,
    password: kidInternalPassword!,
  });
  if (signinErr) {
    logger.error('kid login: signin failed', { request_id: reqId, error_code: signinErr.message });
    redirect('/login?error=' + encodeURIComponent('로그인 실패'));
  }

  logger.info('kid login: success', {
    request_id: reqId,
    actor_role: 'kid',
    action: 'loginAsKidWithCode',
    success: true,
  });
  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
