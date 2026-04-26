'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { getMyKidAccount } from '@/lib/db/queries';
import { logger, generateRequestId } from '@/lib/observability/logger';

export async function kidDeposit(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const amount = Number(formData.get('amount'));
  if (!Number.isInteger(amount) || amount <= 0) {
    redirect('/dashboard?error=' + encodeURIComponent('금액을 다시 확인해주세요'));
  }

  const ctx = await getMyKidAccount();
  if (!ctx) redirect('/login');

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('process_deposit', {
    p_account_id: ctx.account.id,
    p_amount: amount,
  });

  if (error) {
    logger.error('kidDeposit: failed', { request_id: reqId, error_code: error.message });
    redirect('/dashboard?error=' + encodeURIComponent(error.message));
  }
  const result = data as { ok: boolean; reason?: string };
  if (!result.ok) {
    redirect('/dashboard?error=' + encodeURIComponent(result.reason ?? '실패'));
  }

  logger.info('kidDeposit: success', { request_id: reqId, action: 'kidDeposit', amount, success: true });
  revalidatePath('/dashboard');
  redirect('/dashboard?deposited=' + amount);
}
