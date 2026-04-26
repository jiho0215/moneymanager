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

export async function loginAsKidWithNames(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const kidNickname = String(formData.get('kidNickname') ?? '').trim();
  const guardianName = String(formData.get('guardianName') ?? '').trim();

  if (!kidNickname || !guardianName) {
    redirect('/login?error=' + encodeURIComponent('자녀 닉네임과 부모님 이름을 모두 입력해주세요.'));
  }

  const admin = getSupabaseAdmin();

  // Find guardian(s) by display_name. Multiple families could share the same parent name.
  const { data: guardians } = await admin
    .from('memberships')
    .select('id, family_id')
    .eq('role', 'guardian')
    .eq('display_name', guardianName);

  if (!guardians || guardians.length === 0) {
    logger.warn('kid login: no matching guardian', { request_id: reqId, success: false });
    redirect('/login?error=' + encodeURIComponent('일치하는 가족이 없어요. 부모님 이름을 다시 확인해주세요.'));
  }

  // Try each guardian's family for matching kid nickname
  let matchedKidUserId: string | null = null;
  for (const g of guardians) {
    const familyId = (g as { family_id: string }).family_id;
    const { data: kids } = await admin
      .from('memberships')
      .select('user_id')
      .eq('family_id', familyId)
      .eq('role', 'kid')
      .eq('display_name', kidNickname);
    if (kids && kids.length > 0) {
      matchedKidUserId = (kids[0] as { user_id: string }).user_id;
      break;
    }
  }

  if (!matchedKidUserId) {
    logger.warn('kid login: no matching kid', { request_id: reqId, success: false });
    redirect('/login?error=' + encodeURIComponent('일치하는 자녀가 없어요. 닉네임을 다시 확인해주세요.'));
  }

  const { data: kidUser, error: uErr } = await admin.auth.admin.getUserById(matchedKidUserId!);
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
    action: 'loginAsKidWithNames',
    success: true,
  });
  redirect('/dashboard');
}

export async function logout(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/');
}
