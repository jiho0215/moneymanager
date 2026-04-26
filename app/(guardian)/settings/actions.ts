'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { logger, generateRequestId } from '@/lib/observability/logger';

export async function updateSettings(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const accountId = String(formData.get('accountId') ?? '');
  const bonusMatchRateBp = Number(formData.get('bonusMatchRateBp'));
  const weeklyDeadlineDow = Number(formData.get('weeklyDeadlineDow'));

  if (!accountId || !Number.isInteger(bonusMatchRateBp) || !Number.isInteger(weeklyDeadlineDow)) {
    redirect('/settings?error=invalid');
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('accounts')
    .update({
      bonus_match_rate_bp: bonusMatchRateBp,
      weekly_deadline_dow: weeklyDeadlineDow,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);

  if (error) {
    logger.error('updateSettings: failed', { request_id: reqId, error_code: error.message });
    redirect('/settings?error=' + encodeURIComponent(error.message));
  }

  logger.info('updateSettings: success', { request_id: reqId, action: 'updateSettings', success: true });
  revalidatePath('/settings');
  redirect('/settings');
}

export async function depositToKid(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const accountId = String(formData.get('accountId') ?? '');
  const amount = Number(formData.get('amount'));
  const zone = String(formData.get('zone'));

  if (!accountId || !Number.isInteger(amount) || amount <= 0 || !['free', 'experiment'].includes(zone)) {
    redirect('/settings?error=invalid');
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('process_deposit', {
    p_account_id: accountId,
    p_amount: amount,
    p_zone: zone,
  });

  if (error) {
    logger.error('depositToKid: rpc error', { request_id: reqId, error_code: error.message });
    redirect('/settings?error=' + encodeURIComponent(error.message));
  }
  const result = data as { ok: boolean; reason?: string; bonus_amount?: number };
  if (!result.ok) {
    redirect('/settings?error=' + encodeURIComponent(result.reason ?? 'failed'));
  }

  logger.info('depositToKid: success', {
    request_id: reqId,
    action: 'depositToKid',
    amount,
    success: true,
  });
  revalidatePath('/settings');
  revalidatePath('/guardian');
  redirect('/settings');
}

export async function chooseCycleEnd(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const accountId = String(formData.get('accountId') ?? '');
  const action = String(formData.get('action'));
  const newStartingCapital = formData.get('newStartingCapital');

  if (!accountId || !['reset', 'extend', 'graduate'].includes(action)) {
    redirect('/settings?error=invalid');
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.rpc('choose_cycle_end_action', {
    p_account_id: accountId,
    p_action: action,
    p_new_starting_capital: action === 'reset' && newStartingCapital ? Number(newStartingCapital) : null,
  });

  if (error) {
    logger.error('chooseCycleEnd: failed', { request_id: reqId, error_code: error.message });
    redirect('/settings?error=' + encodeURIComponent(error.message));
  }

  logger.info('chooseCycleEnd: success', { request_id: reqId, action: `cycle_${action}`, success: true });
  revalidatePath('/settings');
  revalidatePath('/guardian');
  redirect('/guardian');
}
