import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getMyKidAccount, getCurrentWeekNum } from '@/lib/db/queries';
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
  const totalBalance =
    Number(account.free_balance) +
    Number(account.experiment_balance) +
    Number(account.bonus_balance);
  const problem = generateProblem({
    seed,
    weekNum: week,
    grade,
    recentProblemTypes: [],
    accountBalance: totalBalance,
  });

  const sp = await searchParams;
  const errorMsg = sp.error;
  const remaining = sp.remaining;

  return (
    <main className="page page-narrow">
      <div className="soft" style={{ marginBottom: 4 }}>{week}주차 청구</div>
      <h1 className="h1" style={{ marginBottom: 'var(--sp-2)' }}>✨ 산수 한 문제</h1>
      <p className="muted" style={{ marginBottom: 'var(--sp-5)' }}>
        문제를 풀면 이번 주 이자가 잠금해제 돼요.
      </p>

      {errorMsg && (
        <div className="alert alert-error fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>
            {errorMsg === 'wrong_answer'
              ? <><strong>조금 다르네요!</strong> 다시 해볼래요? <span className="soft">(남은 시도: {remaining ?? ''})</span></>
              : errorMsg === 'attempts_exhausted'
              ? <><strong>이번 주는 다음 주에 다시!</strong> 5번 다 썼어요. 다음 주에 새 기회.</>
              : decodeURIComponent(errorMsg)}
          </div>
        </div>
      )}

      <div
        className="card fade-in"
        style={{
          padding: 'var(--sp-7) var(--sp-5)',
          fontSize: '1.75rem',
          fontWeight: 700,
          textAlign: 'center',
          marginBottom: 'var(--sp-4)',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '2px solid var(--free)',
          minHeight: '140px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {problem.question}
      </div>

      <form action={submitClaimAnswer} className="stack-3">
        <input type="hidden" name="problemId" value={problem.id} />
        <input type="hidden" name="expectedAnswer" value={problem.expectedAnswer} />
        <input type="hidden" name="problemData" value={JSON.stringify(problem)} />
        <input type="hidden" name="weekNum" value={week} />
        <input
          type="text"
          name="userAnswer"
          placeholder="답을 적어보자"
          required
          autoComplete="off"
          autoFocus
          style={{
            padding: '18px',
            fontSize: '1.6rem',
            textAlign: 'center',
            borderRadius: 'var(--r-md)',
            border: '2px solid var(--border-strong)',
            fontWeight: 600,
          }}
        />
        <SubmitButton variant="success" pendingText="확인 중..." style={{ padding: '16px', fontSize: '1.1rem' }}>
          제출하기
        </SubmitButton>
        <Link href="/dashboard" className="btn btn-ghost" style={{ justifyContent: 'center' }}>
          ← 다음에 풀기
        </Link>
      </form>
    </main>
  );
}
