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

export async function addKid(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const grade = Number(formData.get('grade'));
  if (!displayName || !Number.isInteger(grade) || grade < 1 || grade > 12) {
    redirect('/settings?error=' + encodeURIComponent('자녀 닉네임과 학년을 확인해주세요'));
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();
  const { data: callerRows } = await admin
    .from('memberships')
    .select('family_id')
    .eq('user_id', user.id)
    .eq('role', 'guardian')
    .single();
  if (!callerRows) redirect('/settings?error=' + encodeURIComponent('가족을 찾을 수 없어요'));
  const familyId = (callerRows as { family_id: string }).family_id;

  const { data, error } = await admin.rpc('add_kid_to_family', {
    p_family_id: familyId,
    p_actor_user_id: user.id,
    p_kid_nickname: displayName,
    p_kid_grade: grade,
  });
  if (error) {
    logger.error('addKid: failed', { request_id: reqId, error_code: error.message });
    redirect('/settings?error=' + encodeURIComponent(error.message));
  }
  const result = data as { ok: boolean; reason?: string; kid_membership_id?: string };
  if (!result.ok) {
    redirect('/settings?error=' + encodeURIComponent(result.reason ?? '실패'));
  }

  logger.info('addKid: success', { request_id: reqId, action: 'addKid', success: true });
  revalidatePath('/settings');
  redirect('/onboarding');
}

export async function resetKidLogin(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const kidMembershipId = String(formData.get('kidMembershipId') ?? '');
  const newLoginId = String(formData.get('newLoginId') ?? '').trim();
  const newPassword = String(formData.get('newPassword') ?? '');

  if (!kidMembershipId) redirect('/settings?error=' + encodeURIComponent('자녀를 찾을 수 없어요'));
  if (newLoginId.length < 1 || newLoginId.length > 20) {
    redirect('/settings?error=' + encodeURIComponent('아이디는 1-20자로 입력해주세요'));
  }
  if (newPassword.length < 4 || newPassword.length > 8) {
    redirect('/settings?error=' + encodeURIComponent('비밀번호는 4-8자로 입력해주세요'));
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();
  const { data: m } = await admin
    .from('memberships')
    .select('user_id, family_id, role')
    .eq('id', kidMembershipId)
    .single();
  if (!m || (m as { role: string }).role !== 'kid') {
    redirect('/settings?error=' + encodeURIComponent('자녀를 찾을 수 없어요'));
  }
  const kid = m as { user_id: string | null; family_id: string };
  if (!kid.user_id) {
    redirect('/settings?error=' + encodeURIComponent('자녀가 아직 로그인 정보를 만들지 않았어요. 초대 링크를 다시 보내주세요.'));
  }

  // Update login_id via RPC (also enforces guardian auth + uniqueness)
  const { data: idResult, error: idErr } = await admin.rpc('reset_kid_login_id', {
    p_kid_membership_id: kidMembershipId,
    p_actor_user_id: user.id,
    p_new_login_id: newLoginId,
  });
  if (idErr) {
    logger.error('resetKidLogin: id rpc error', { request_id: reqId, error_code: idErr.message });
    redirect('/settings?error=' + encodeURIComponent(idErr.message));
  }
  const r = idResult as { ok: boolean; reason?: string };
  if (!r.ok) {
    redirect('/settings?error=' + encodeURIComponent(r.reason === 'login_id_taken' ? '이미 사용 중인 아이디예요' : (r.reason ?? '실패')));
  }

  // Update auth user password
  const { error: pwErr } = await admin.auth.admin.updateUserById(kid.user_id, { password: newPassword });
  if (pwErr) {
    logger.error('resetKidLogin: password update failed', { request_id: reqId, error_code: pwErr.message });
    redirect('/settings?error=' + encodeURIComponent('비밀번호 업데이트 실패'));
  }

  logger.info('resetKidLogin: success', { request_id: reqId, action: 'resetKidLogin', success: true });
  revalidatePath('/settings');
  redirect('/settings?login_reset=1');
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
