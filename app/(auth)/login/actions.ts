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

export async function loginAsKidWithPin(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const kidNickname = String(formData.get('kidNickname') ?? '').trim();
  const kidPin = String(formData.get('kidPin') ?? '').trim();

  if (!kidNickname || !kidPin) {
    redirect('/login?error=' + encodeURIComponent('자녀 닉네임과 PIN을 입력해주세요.'));
  }
  if (!/^\d{4}$/.test(kidPin)) {
    redirect('/login?error=' + encodeURIComponent('PIN은 숫자 4자리예요.'));
  }

  const admin = getSupabaseAdmin();
  // Globally unique kid nickname (DB index enforced)
  const { data: memberships } = await admin
    .from('memberships')
    .select('user_id')
    .eq('role', 'kid')
    .eq('display_name', kidNickname);

  if (!memberships || memberships.length === 0) {
    logger.warn('kid login: nickname not found', { request_id: reqId, success: false });
    redirect('/login?error=' + encodeURIComponent('일치하는 자녀가 없어요. 닉네임을 다시 확인해주세요.'));
  }

  const userId = (memberships[0] as { user_id: string }).user_id;
  const { data: kidUser, error: uErr } = await admin.auth.admin.getUserById(userId);
  if (uErr || !kidUser.user) redirect('/login?error=' + encodeURIComponent('자녀 인증 실패'));

  const meta = kidUser.user!.user_metadata as { internal_password?: string; kid_pin?: string };
  const storedPin = meta?.kid_pin;
  const internalPassword = meta?.internal_password;
  if (!storedPin || !internalPassword) {
    redirect('/login?error=' + encodeURIComponent('PIN이 설정되지 않은 자녀예요. 보호자에게 다시 가입을 요청해주세요.'));
  }

  if (storedPin !== kidPin) {
    logger.warn('kid login: wrong pin', { request_id: reqId, success: false });
    redirect('/login?error=' + encodeURIComponent('PIN이 틀렸어요. 다시 확인해주세요.'));
  }

  const supabase = await getSupabaseServerClient();
  const { error: signinErr } = await supabase.auth.signInWithPassword({
    email: kidUser.user!.email!,
    password: internalPassword!,
  });
  if (signinErr) {
    logger.error('kid login: signin failed', { request_id: reqId, error_code: signinErr.message });
    redirect('/login?error=' + encodeURIComponent('로그인 실패'));
  }

  logger.info('kid login: success', {
    request_id: reqId,
    actor_role: 'kid',
    action: 'loginAsKidWithPin',
    success: true,
  });
  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
