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

export async function loginAsKid(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const loginId = String(formData.get('loginId') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const remember = formData.get('remember') !== 'off';

  if (!loginId || !password) {
    redirect('/login?error=' + encodeURIComponent('아이디와 비밀번호를 입력해주세요.'));
  }

  const admin = getSupabaseAdmin();
  const { data: memberships } = await admin
    .from('memberships')
    .select('user_id, display_name')
    .eq('role', 'kid')
    .eq('login_id', loginId);

  if (!memberships || memberships.length === 0) {
    logger.warn('kid login: login_id not found', { request_id: reqId, success: false });
    redirect('/login?error=' + encodeURIComponent('아이디 또는 비밀번호가 맞지 않아요.'));
  }

  const userId = (memberships[0] as { user_id: string | null }).user_id;
  if (!userId) {
    redirect('/login?error=' + encodeURIComponent('아직 로그인 정보를 만들지 않은 아이디예요. 보호자에게 받은 링크에서 먼저 만들어주세요.'));
  }

  const { data: kidUser, error: uErr } = await admin.auth.admin.getUserById(userId);
  if (uErr || !kidUser.user) {
    redirect('/login?error=' + encodeURIComponent('자녀 인증 실패'));
  }

  const supabase = await getSupabaseServerClient();
  const { error: signinErr } = await supabase.auth.signInWithPassword({
    email: kidUser.user!.email!,
    password,
  });
  if (signinErr) {
    logger.warn('kid login: wrong password', { request_id: reqId, success: false });
    redirect('/login?error=' + encodeURIComponent('아이디 또는 비밀번호가 맞지 않아요.'));
  }

  logger.info('kid login: success', {
    request_id: reqId,
    actor_role: 'kid',
    action: 'loginAsKid',
    success: true,
  });
  // Pass through the remember flag so the client form can update localStorage.
  redirect('/dashboard?remembered=' + (remember ? '1' : '0'));
}

export async function logout(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
