import { getMyKidAccount, getCurrentWeekNum } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { generateProblem } from '@/lib/domain/mathgen';
import { submitClaimAnswer } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

export const dynamic = 'force-dynamic';

export default async function ClaimPage({ searchParams }: { searchParams: Promise<{ error?: string; remaining?: string }> }) {
  const ctx = await getMyKidAccount();
  if (!ctx) redirect('/login');

  const { account } = ctx;
  const week = await getCurrentWeekNum(String(account.id));
  if (week === 0) redirect('/dashboard');
  if (account.last_claimed_week_num !== null && Number(account.last_claimed_week_num) >= week) {
    redirect('/dashboard');
  }

  const grade = (Number(ctx.membership.grade) || 5) as 5 | 6;
  const seed = `${account.id}_${week}`;
  const problem = generateProblem({
    seed,
    weekNum: week,
    grade,
    recentProblemTypes: [],
    accountBalance: Number(account.experiment_balance),
  });

  const sp = await searchParams;

  return (
    <main style={{ maxWidth: '560px', margin: '0 auto', padding: '24px' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>✨ 이번 주 산수</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        문제를 풀면 이번 주 이자가 잠금해제 됩니다 ({week}주차).
      </p>

      {sp.error && (
        <div style={{ padding: '12px', backgroundColor: '#fee', borderRadius: '6px', marginBottom: '1rem' }}>
          {sp.error === 'wrong_answer'
            ? `조금 다르네요! 다시 해볼래요? (${sp.remaining ?? ''}번 남음)`
            : sp.error === 'attempts_exhausted'
            ? '이번 주는 다음 주에 다시! 5번 다 썼어요.'
            : sp.error}
        </div>
      )}

      <div
        style={{
          padding: '32px',
          backgroundColor: '#fff8dc',
          borderRadius: '12px',
          fontSize: '1.5rem',
          textAlign: 'center',
          fontWeight: 'bold',
          marginBottom: '1rem',
          minHeight: '120px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {problem.question}
      </div>

      <form action={submitClaimAnswer} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input type="hidden" name="problemId" value={problem.id} />
        <input type="hidden" name="expectedAnswer" value={problem.expectedAnswer} />
        <input type="hidden" name="problemData" value={JSON.stringify(problem)} />
        <input type="hidden" name="weekNum" value={week} />
        <input
          type="text"
          name="userAnswer"
          placeholder="답"
          required
          autoComplete="off"
          style={{ padding: '14px', fontSize: '1.4rem', textAlign: 'center', borderRadius: '8px', border: '2px solid #ddd' }}
        />
        <SubmitButton variant="success" pendingText="확인 중..." style={{ padding: '14px', fontSize: '1.1rem', borderRadius: '8px' }}>
          제출하기
        </SubmitButton>
        <a href="/dashboard" style={{ textAlign: 'center', color: '#666', fontSize: '0.9rem' }}>
          ← 다음에 풀기
        </a>
      </form>
    </main>
  );
}
