'use server';

import { redirect } from 'next/navigation';
import { getSupabaseAdmin, generateKidInternalEmail, generateKidInternalPassword } from '@/lib/auth/admin';
import { getSupabaseServerClient } from '@/lib/db/client';
import { logger, generateRequestId } from '@/lib/observability/logger';

const PIPA_CONSENT_TEXT_V1 = `[개인정보 수집 및 이용 동의 — 만 14세 미만 자녀]

본인은 자녀의 법정대리인으로서 다음 사항에 동의합니다:
1. 수집 항목: 자녀의 닉네임, 학년, 잔액 데이터
2. 이용 목적: 가족 내 복리 학습 경험 제공
3. 보유 기간: 가족 탈퇴 시점부터 30일 후 cascade 삭제
4. 자녀의 직접 가입 없이 본인이 대리 등록함
5. 자녀가 만 19세 도달 시 데이터 export 권리 보장

본 동의는 PIPA Article 22 에 따른 명시적 법정대리인 동의입니다.`;

export async function signupFamily(formData: FormData): Promise<void> {
  const reqId = generateRequestId();

  const guardianEmail = String(formData.get('guardianEmail') ?? '').trim();
  const guardianPassword = String(formData.get('guardianPassword') ?? '');
  const familyName = String(formData.get('familyName') ?? '').trim();
  const guardianDisplayName = String(formData.get('guardianDisplayName') ?? '').trim();
  const kidNickname = String(formData.get('kidNickname') ?? '').trim();
  const kidGrade = Number(formData.get('kidGrade'));
  const startingCapital = Number(formData.get('startingCapital'));
  const consent = formData.get('consent') === 'on';

  if (!guardianEmail || !guardianPassword || !familyName || !kidNickname || !consent) {
    redirect('/signup?error=' + encodeURIComponent('필수 항목 누락'));
  }
  if (guardianPassword.length < 8) redirect('/signup?error=' + encodeURIComponent('비밀번호 8자 이상'));
  if (kidGrade < 5 || kidGrade > 6) redirect('/signup?error=' + encodeURIComponent('학년은 5 또는 6'));
  if (!Number.isInteger(startingCapital) || startingCapital < 1000 || startingCapital > 1_000_000) {
    redirect('/signup?error=' + encodeURIComponent('시작 자금 1,000-1,000,000 사이'));
  }

  const admin = getSupabaseAdmin();

  const { data: gAuth, error: gErr } = await admin.auth.admin.createUser({
    email: guardianEmail,
    password: guardianPassword,
    email_confirm: true,
    user_metadata: { role: 'guardian', display_name: guardianDisplayName || familyName },
  });
  if (gErr || !gAuth.user) {
    logger.error('signup: guardian create failed', { request_id: reqId, error_code: gErr?.message });
    redirect('/signup?error=' + encodeURIComponent(gErr?.message ?? 'guardian 생성 실패'));
  }
  const guardianUserId = gAuth.user.id;

  const kidEmail = generateKidInternalEmail();
  const kidPassword = generateKidInternalPassword();
  const { data: kAuth, error: kErr } = await admin.auth.admin.createUser({
    email: kidEmail,
    password: kidPassword,
    email_confirm: true,
    user_metadata: {
      role: 'kid',
      display_name: kidNickname,
      internal_password: kidPassword,
    },
  });
  if (kErr || !kAuth.user) {
    await admin.auth.admin.deleteUser(guardianUserId).catch(() => {});
    logger.error('signup: kid create failed', { request_id: reqId, error_code: kErr?.message });
    redirect('/signup?error=' + encodeURIComponent(kErr?.message ?? 'kid 생성 실패'));
  }
  const kidUserId = kAuth.user.id;

  const { error: rpcErr } = await admin.rpc('create_family_with_kid', {
    p_family_name: familyName,
    p_guardian_user_id: guardianUserId,
    p_guardian_display_name: guardianDisplayName || familyName,
    p_kid_user_id: kidUserId,
    p_kid_nickname: kidNickname,
    p_kid_grade: kidGrade,
    p_starting_capital: startingCapital,
    p_consent_text: PIPA_CONSENT_TEXT_V1,
    p_consent_version: 'v1',
  });
  if (rpcErr) {
    await admin.auth.admin.deleteUser(guardianUserId).catch(() => {});
    await admin.auth.admin.deleteUser(kidUserId).catch(() => {});
    logger.error('signup: rpc failed', { request_id: reqId, error_code: rpcErr.message });
    redirect('/signup?error=' + encodeURIComponent(rpcErr.message));
  }

  logger.info('signup: family created', {
    request_id: reqId,
    actor_role: 'anon',
    action: 'createFamily',
    success: true,
  });

  const supabase = await getSupabaseServerClient();
  await supabase.auth.signInWithPassword({ email: guardianEmail, password: guardianPassword });

  redirect('/guardian');
}
