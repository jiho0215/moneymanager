'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { getSupabaseServerClient } from '@/lib/db/client';
import { logger, generateRequestId } from '@/lib/observability/logger';

export async function rotateKidCode(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const kidMembershipId = String(formData.get('kidMembershipId') ?? '');
  if (!kidMembershipId) redirect('/kid-access?error=no_kid');

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('rotate_kid_access_code', {
    p_kid_membership_id: kidMembershipId,
    p_guardian_user_id: user.id,
  });

  if (error) {
    logger.error('rotateKidCode: failed', { request_id: reqId, error_code: error.message });
    redirect('/kid-access?error=' + encodeURIComponent(error.message));
  }

  logger.info('rotateKidCode: success', { request_id: reqId, action: 'rotateKidCode', success: true });
  revalidatePath('/kid-access');
  redirect('/kid-access?rotated=' + encodeURIComponent(String(data)));
}
