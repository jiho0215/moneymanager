import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@/lib/db/client';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { ParentWizard } from './parent-wizard';
import { KidWizard } from './kid-wizard';

export const dynamic = 'force-dynamic';

type AccountRow = {
  id: string;
  membership_id: string;
  setup_state: string;
  starting_capital: number;
  weekly_growth_rate_bp: number;
  recommended_starting_capital: number | null;
  recommended_scenario: string | null;
  recommended_total_weeks: number | null;
  scenario: string;
  total_weeks: number;
};

export default async function OnboardingPage() {
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: m } = await supabase
    .from('memberships')
    .select('id, family_id, role, display_name')
    .eq('user_id', user.id)
    .single();
  if (!m) redirect('/login');

  const membership = m as { id: string; family_id: string; role: string; display_name: string };
  const admin = getSupabaseAdmin();

  if (membership.role === 'guardian') {
    const { data: kids } = await admin
      .from('memberships')
      .select('id, display_name')
      .eq('family_id', membership.family_id)
      .eq('role', 'kid');
    const kidIds = (kids ?? []).map((k) => (k as { id: string }).id);
    const { data: accs } = await admin
      .from('accounts')
      .select('id, membership_id, setup_state, starting_capital, weekly_growth_rate_bp, recommended_starting_capital, recommended_scenario, recommended_total_weeks, scenario, total_weeks')
      .in('membership_id', kidIds);

    const accounts = ((accs ?? []) as AccountRow[]);
    const pending = accounts.find((a) => a.setup_state === 'parent_setup_pending');
    if (!pending) redirect('/guardian');

    const kid = (kids ?? []).find((k) => (k as { id: string }).id === pending.membership_id) as { display_name: string } | undefined;

    return (
      <main className="page page-narrow">
        <ParentWizard
          accountId={pending.id}
          kidName={kid?.display_name ?? ''}
        />
      </main>
    );
  }

  if (membership.role === 'kid') {
    const { data: acc } = await admin
      .from('accounts')
      .select('id, membership_id, setup_state, starting_capital, weekly_growth_rate_bp, recommended_starting_capital, recommended_scenario, recommended_total_weeks, scenario, total_weeks')
      .eq('membership_id', membership.id)
      .single();
    const account = acc as AccountRow | null;
    if (!account) redirect('/login');
    if (account.setup_state === 'active') redirect('/dashboard');
    if (account.setup_state === 'parent_setup_pending') {
      // Kid arrived before parent finished setup
      return (
        <main className="page page-narrow">
          <section className="card stack-3" style={{ marginTop: 'var(--sp-6)' }}>
            <h1 className="h2">⏳ 잠깐만 기다려주세요</h1>
            <p className="muted" style={{ margin: 0 }}>
              보호자가 통장 설정을 마쳐야 시작할 수 있어요. 설정이 끝나면 다시 로그인해주세요.
            </p>
          </section>
        </main>
      );
    }

    return (
      <main className="page page-narrow">
        <KidWizard
          accountId={account.id}
          kidName={membership.display_name}
          recommendedStartingCapital={account.recommended_starting_capital ?? 10000}
          recommendedScenario={(account.recommended_scenario ?? 'one-time') as 'one-time' | 'regular'}
          recommendedTotalWeeks={account.recommended_total_weeks ?? 8}
          weeklyRatePct={Math.round((account.weekly_growth_rate_bp ?? 1000) / 100)}
        />
      </main>
    );
  }

  redirect('/');
}
