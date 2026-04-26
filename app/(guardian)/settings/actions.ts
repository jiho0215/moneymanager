'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { getSupabaseServerClient } from '@/lib/db/client';
import { logger, generateRequestId } from '@/lib/observability/logger';

export async function updateFamilyTimezone(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const familyId = String(formData.get('familyId') ?? '');
  const timezone = String(formData.get('timezone') ?? '').trim();
  if (!familyId || !timezone) {
    redirect('/settings?error=' + encodeURIComponent('시간대 입력 오류'));
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('update_family_timezone', {
    p_family_id: familyId,
    p_timezone: timezone,
    p_actor_user_id: user.id,
  });
  if (error) {
    logger.error('updateFamilyTimezone: rpc error', { request_id: reqId, error_code: error.message });
    redirect('/settings?error=' + encodeURIComponent(error.message));
  }
  const result = data as { ok: boolean; reason?: string };
  if (!result.ok) {
    redirect('/settings?error=' + encodeURIComponent(result.reason ?? '실패'));
  }

  logger.info('updateFamilyTimezone: success', { request_id: reqId, action: 'updateFamilyTimezone', success: true });
  revalidatePath('/settings');
  redirect('/settings?tz_changed=1');
}

export async function changeKidPin(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const kidMembershipId = String(formData.get('kidMembershipId') ?? '');
  const newPin = String(formData.get('newPin') ?? '').trim();

  if (!kidMembershipId) redirect('/settings?error=' + encodeURIComponent('자녀를 찾을 수 없어요'));
  if (!/^\d{4}$/.test(newPin)) {
    redirect('/settings?error=' + encodeURIComponent('PIN은 숫자 4자리여야 해요 (예: 1234)'));
  }

  const admin = getSupabaseAdmin();
  const { data: membership } = await admin
    .from('memberships')
    .select('user_id, role, family_id')
    .eq('id', kidMembershipId)
    .single();
  if (!membership) {
    redirect('/settings?error=' + encodeURIComponent('자녀 멤버십 조회 실패'));
  }

  const m = membership as { user_id: string; role: string; family_id: string };
  if (m.role !== 'kid') redirect('/settings?error=' + encodeURIComponent('자녀가 아닙니다'));

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: callerRows } = await admin
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('family_id', m.family_id)
    .eq('role', 'guardian');
  if (!callerRows || callerRows.length === 0) {
    redirect('/settings?error=' + encodeURIComponent('권한 없음'));
  }

  const { data: kidUser } = await admin.auth.admin.getUserById(m.user_id);
  if (!kidUser?.user) redirect('/settings?error=' + encodeURIComponent('자녀 인증 조회 실패'));

  const currentMeta = (kidUser.user.user_metadata ?? {}) as Record<string, unknown>;
  const { error: uErr } = await admin.auth.admin.updateUserById(m.user_id, {
    user_metadata: { ...currentMeta, kid_pin: newPin },
  });
  if (uErr) {
    logger.error('changeKidPin: update failed', { request_id: reqId, error_code: uErr.message });
    redirect('/settings?error=' + encodeURIComponent('PIN 업데이트 실패'));
  }

  logger.info('changeKidPin: success', { request_id: reqId, action: 'changeKidPin', success: true });
  revalidatePath('/settings');
  redirect('/settings?pin_changed=1');
}

export async function updateSettings(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const accountId = String(formData.get('accountId') ?? '');
  const weeklyDeadlineDow = Number(formData.get('weeklyDeadlineDow'));

  if (!accountId || !Number.isInteger(weeklyDeadlineDow)) {
    redirect('/settings?error=invalid');
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin
    .from('accounts')
    .update({
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

  if (!accountId || !Number.isInteger(amount) || amount <= 0) {
    redirect('/settings?error=invalid');
  }

  const admin = getSupabaseAdmin();
  const { data, error } = await admin.rpc('process_deposit', {
    p_account_id: accountId,
    p_amount: amount,
  });

  if (error) {
    logger.error('depositToKid: rpc error', { request_id: reqId, error_code: error.message });
    redirect('/settings?error=' + encodeURIComponent(error.message));
  }
  const result = data as { ok: boolean; reason?: string };
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

export async function timeWarp(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const accountId = String(formData.get('accountId') ?? '');
  const action = String(formData.get('action'));
  if (!accountId || !['advance_week', 'rewind_week', 'reset_today'].includes(action)) {
    redirect('/settings?error=invalid');
  }

  const admin = getSupabaseAdmin();
  const { data: account, error: gErr } = await admin
    .from('accounts')
    .select('epoch_kst')
    .eq('id', accountId)
    .single();
  if (gErr || !account) redirect('/settings?error=' + encodeURIComponent('account not found'));
  const epoch = (account as { epoch_kst: string }).epoch_kst;
  const now = new Date();
  let newEpoch: Date;

  if (action === 'advance_week') {
    // Shift epoch BACKWARD by 7 days = current week_num +1
    newEpoch = new Date(new Date(epoch).getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (action === 'rewind_week') {
    newEpoch = new Date(new Date(epoch).getTime() + 7 * 24 * 60 * 60 * 1000);
  } else {
    // reset_today: epoch = next Sunday 00:00 KST from NOW
    const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dow = kstNow.getUTCDay(); // 0=Sun..6=Sat
    const daysUntilSunday = ((6 - dow) % 7) + 1;
    const sunday = new Date(kstNow);
    sunday.setUTCHours(0, 0, 0, 0);
    sunday.setUTCDate(sunday.getUTCDate() + daysUntilSunday);
    newEpoch = new Date(sunday.getTime() - 9 * 60 * 60 * 1000);
  }

  const { error } = await admin
    .from('accounts')
    .update({ epoch_kst: newEpoch.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', accountId);
  if (error) {
    logger.error('timeWarp: failed', { request_id: reqId, error_code: error.message });
    redirect('/settings?error=' + encodeURIComponent(error.message));
  }

  logger.info('timeWarp: success', { request_id: reqId, action: `time_warp_${action}`, success: true });
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/guardian');
  redirect('/settings?warped=' + encodeURIComponent(action));
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
