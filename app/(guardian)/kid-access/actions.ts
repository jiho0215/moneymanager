'use server';

import { redirect } from 'next/navigation';
import { getSupabaseAdmin, generateKidLoginCode } from '@/lib/auth/admin';
import { getSupabaseServerClient } from '@/lib/db/client';
import { logger, generateRequestId } from '@/lib/observability/logger';

export async function issueKidCode(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const kidMembershipId = String(formData.get('kidMembershipId') ?? '');
  if (!kidMembershipId) redirect('/kid-access?error=no_kid');

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const code = generateKidLoginCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc('generate_kid_login_code', {
    p_kid_membership_id: kidMembershipId,
    p_guardian_user_id: user.id,
    p_code: code,
    p_expires_at: expiresAt,
  });

  if (error) {
    logger.error('issueKidCode: failed', { request_id: reqId, error_code: error.message });
    redirect('/kid-access?error=' + encodeURIComponent(error.message));
  }

  logger.info('issueKidCode: success', { request_id: reqId, action: 'generateKidLoginCode', success: true });
  redirect(`/kid-access?new_code=${code}&expires=${encodeURIComponent(new Date(expiresAt).toLocaleString('ko-KR'))}`);
}
