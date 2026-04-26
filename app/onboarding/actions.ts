'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { getSupabaseServerClient } from '@/lib/db/client';
import { logger, generateRequestId } from '@/lib/observability/logger';

export async function saveParentRecommendations(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const accountId = String(formData.get('accountId') ?? '');
  const startingCapital = Number(formData.get('startingCapital'));
  const scenario = String(formData.get('scenario'));
  const totalWeeks = Number(formData.get('totalWeeks'));
  const ratePct = Number(formData.get('ratePct'));

  logger.info('saveParentRecommendations: invoked', {
    request_id: reqId,
    action: 'saveParentRecommendations:start',
    accountId,
    startingCapital,
    scenario,
    totalWeeks,
    ratePct,
  });

  if (
    !accountId ||
    !Number.isInteger(startingCapital) ||
    !['one-time', 'regular'].includes(scenario) ||
    !Number.isInteger(totalWeeks) ||
    !Number.isInteger(ratePct)
  ) {
    redirect('/onboarding?error=invalid');
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();

  // Auth: caller must be guardian of the family that owns this kid account
  const { data: acc } = await admin
    .from('accounts')
    .select('id, membership_id')
    .eq('id', accountId)
    .single();
  if (!acc) redirect('/onboarding?error=' + encodeURIComponent('account not found'));
  const { data: kidM } = await admin
    .from('memberships')
    .select('family_id')
    .eq('id', (acc as { membership_id: string }).membership_id)
    .single();
  if (!kidM) redirect('/onboarding?error=' + encodeURIComponent('membership not found'));
  const { data: callerRows } = await admin
    .from('memberships')
    .select('id')
    .eq('user_id', user.id)
    .eq('family_id', (kidM as { family_id: string }).family_id)
    .eq('role', 'guardian');
  if (!callerRows || callerRows.length === 0) {
    redirect('/onboarding?error=' + encodeURIComponent('권한 없음'));
  }

  const { data, error } = await admin.rpc('finalize_parent_recommendations', {
    p_account_id: accountId,
    p_recommended_starting_capital: startingCapital,
    p_recommended_scenario: scenario,
    p_recommended_total_weeks: totalWeeks,
    p_weekly_growth_rate_bp: ratePct * 100,
  });

  if (error) {
    logger.error('parent onboarding: failed', { request_id: reqId, error_code: error.message });
    redirect('/onboarding?error=' + encodeURIComponent(error.message));
  }
  const result = data as { ok: boolean; reason?: string };
  if (!result.ok) {
    redirect('/onboarding?error=' + encodeURIComponent(result.reason ?? '실패'));
  }

  logger.info('parent onboarding: done', { request_id: reqId, action: 'finalize_parent_recommendations', success: true });
  revalidatePath('/onboarding');
  redirect('/guardian?setup=parent_done');
}

export async function saveKidChoices(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const accountId = String(formData.get('accountId') ?? '');
  const startingCapital = Number(formData.get('startingCapital'));
  const scenario = String(formData.get('scenario'));
  const totalWeeks = Number(formData.get('totalWeeks'));

  if (
    !accountId ||
    !Number.isInteger(startingCapital) ||
    !['one-time', 'regular'].includes(scenario) ||
    !Number.isInteger(totalWeeks)
  ) {
    redirect('/onboarding?error=invalid');
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const admin = getSupabaseAdmin();
  const { data: m } = await admin
    .from('memberships')
    .select('id, role')
    .eq('user_id', user.id)
    .single();
  if (!m || (m as { role: string }).role !== 'kid') {
    redirect('/onboarding?error=' + encodeURIComponent('권한 없음'));
  }
  const { data: acc } = await admin
    .from('accounts')
    .select('id, membership_id')
    .eq('membership_id', (m as { id: string }).id)
    .single();
  if (!acc || (acc as { id: string }).id !== accountId) {
    redirect('/onboarding?error=' + encodeURIComponent('이 통장이 아니에요'));
  }

  const { data, error } = await admin.rpc('finalize_kid_choices', {
    p_account_id: accountId,
    p_starting_capital: startingCapital,
    p_scenario: scenario,
    p_total_weeks: totalWeeks,
  });

  if (error) {
    logger.error('kid onboarding: failed', { request_id: reqId, error_code: error.message });
    redirect('/onboarding?error=' + encodeURIComponent(error.message));
  }
  const result = data as { ok: boolean; reason?: string };
  if (!result.ok) {
    redirect('/onboarding?error=' + encodeURIComponent(result.reason ?? '실패'));
  }

  logger.info('kid onboarding: done', { request_id: reqId, action: 'finalize_kid_choices', success: true });
  revalidatePath('/onboarding');
  redirect('/dashboard?setup=kid_done');
}
