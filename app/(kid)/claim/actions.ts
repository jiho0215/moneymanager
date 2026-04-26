'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/db/client';
import { getMyKidAccount } from '@/lib/db/queries';
import { logger, generateRequestId } from '@/lib/observability/logger';

export async function submitClaimAnswer(formData: FormData): Promise<void> {
  const reqId = generateRequestId();
  const problemId = String(formData.get('problemId') ?? '');
  const expectedAnswer = String(formData.get('expectedAnswer') ?? '');
  const userAnswer = String(formData.get('userAnswer') ?? '');
  const weekNum = Number(formData.get('weekNum'));
  const problemDataRaw = String(formData.get('problemData') ?? '{}');

  let problemData: Record<string, string | number | boolean | null> = {};
  try { problemData = JSON.parse(problemDataRaw); } catch { /* ignore */ }

  const ctx = await getMyKidAccount();
  if (!ctx) redirect('/login');

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc('process_claim', {
    p_account_id: ctx.account.id,
    p_week_num: weekNum,
    p_problem_id: problemId,
    p_user_answer: userAnswer,
    p_expected_answer: expectedAnswer,
    p_problem_data: problemData,
  });

  if (error) {
    logger.error('claim: rpc error', { request_id: reqId, error_code: error.message });
    redirect(`/claim?error=${encodeURIComponent(error.message)}`);
  }
  const result = data as { ok: boolean; reason?: string; growth_this_week?: number; attempts_remaining?: number };

  logger.info('claim: result', {
    request_id: reqId,
    actor_role: 'kid',
    action: 'attemptClaim',
    week_num: weekNum,
    problem_id: problemId,
    answer_correct: result.ok,
    success: result.ok,
    error_code: result.ok ? undefined : result.reason,
  });

  if (!result.ok) {
    const remaining = result.attempts_remaining !== undefined ? `&remaining=${result.attempts_remaining}` : '';
    redirect(`/claim?error=${encodeURIComponent(result.reason ?? 'failed')}${remaining}`);
  }

  revalidatePath('/dashboard');
  redirect('/dashboard?claimed=' + result.growth_this_week);
}
