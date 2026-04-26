'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/db/client';
import { getMyKidAccount } from '@/lib/db/queries';
import { logger, generateRequestId } from '@/lib/observability/logger';

export async function transferToExperiment(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const amount = Number(formData.get('amount'));
  if (!Number.isInteger(amount) || amount <= 0) {
    redirect('/dashboard?error=' + encodeURIComponent('금액 오류'));
  }

  const ctx = await getMyKidAccount();
  if (!ctx) redirect('/login');

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc('transfer_free_to_experiment', {
    p_account_id: ctx.account.id,
    p_amount: amount,
  });

  if (error) {
    logger.error('transfer: failed', { request_id: reqId, error_code: error.message });
    redirect('/dashboard?error=' + encodeURIComponent(error.message));
  }
  const result = data as { ok: boolean; reason?: string };
  if (!result.ok) {
    redirect('/dashboard?error=' + encodeURIComponent(result.reason ?? '실패'));
  }

  logger.info('transfer: success', { request_id: reqId, action: 'transferToExperiment', amount, success: true });
  revalidatePath('/dashboard');
  redirect('/dashboard');
}
