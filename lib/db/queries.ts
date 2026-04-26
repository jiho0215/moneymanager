import { getSupabaseServerClient } from './client';

export async function getMyKidAccount() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, family_id, role, display_name, age_tier, grade, access_code')
    .eq('user_id', user.id)
    .single();
  if (!membership) return null;

  const m = membership as {
    id: string;
    family_id: string;
    role: string;
    display_name: string;
    age_tier: string | null;
    grade: number | null;
    access_code: string | null;
  };

  if (m.role !== 'kid') return null;

  const { data: account } = await supabase
    .from('accounts')
    .select('*')
    .eq('membership_id', m.id)
    .single();
  if (!account) return null;

  const { data: guardians } = await supabase
    .from('memberships')
    .select('display_name')
    .eq('family_id', m.family_id)
    .eq('role', 'guardian')
    .limit(1);
  const guardianName =
    (guardians?.[0] as { display_name: string } | undefined)?.display_name ?? '';

  return {
    membership: m,
    account: account as Record<string, number | string | null>,
    guardianName,
  };
}

export async function getCurrentWeekNum(accountId: string): Promise<number> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.rpc('compute_week_num', { p_account_id: accountId });
  if (error || data === null) return 0;
  return Number(data);
}

export async function getGuardianFamilyView() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from('memberships')
    .select('id, family_id, role, display_name')
    .eq('user_id', user.id)
    .single();
  if (!membership) return null;

  const guardian = membership as {
    id: string;
    family_id: string;
    role: string;
    display_name: string;
  };
  if (guardian.role !== 'guardian') return null;

  const { data: kids } = await supabase
    .from('memberships')
    .select('id, display_name, age_tier, grade, user_id, access_code')
    .eq('family_id', guardian.family_id)
    .eq('role', 'kid');

  const kidMembershipIds = (kids ?? []).map((k) => (k as { id: string }).id);
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .in('membership_id', kidMembershipIds);

  return {
    guardian,
    kids: kids ?? [],
    accounts: accounts ?? [],
  };
}
