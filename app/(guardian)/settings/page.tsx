import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { updateSettings, depositToKid, chooseCycleEnd } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');

  return (
    <main className="page">
      <h1 className="h1" style={{ marginBottom: 'var(--sp-5)' }}>⚙️ 가족 설정</h1>

      <div className="stack-5">
        {ctx.kids.map((k) => {
          const kid = k as { id: string; display_name: string };
          const account = (ctx.accounts as Array<{ id: string; membership_id: string; weekly_growth_rate_bp: number; bonus_match_rate_bp: number; weekly_deadline_dow: number; cycle_status: string; cycle_number: number }>).find((a) => String(a.membership_id) === String(kid.id));
          if (!account) return null;
          return (
            <section key={kid.id} className="card stack-5">
              <div className="row-between">
                <h2 className="h2">🌱 {kid.display_name}</h2>
                <span className="badge badge-success">사이클 {account.cycle_number}</span>
              </div>

              <fieldset className="stack-3">
                <legend>📐 청구 룰</legend>
                <label className="field">
                  매칭 비율 <span className="soft">(basis points: 2000 = 20%)</span>
                  <input type="number" form={`form-rule-${kid.id}`} name="bonusMatchRateBp" defaultValue={account.bonus_match_rate_bp} min={0} max={10000} step={100} required />
                </label>
                <label className="field">
                  주간 청구 마감 요일 <span className="soft">(0=일~6=토)</span>
                  <input type="number" form={`form-rule-${kid.id}`} name="weeklyDeadlineDow" defaultValue={account.weekly_deadline_dow} min={0} max={6} required />
                </label>
                <p className="soft" style={{ margin: 0 }}>
                  ℹ️ 매칭 비율 변경은 <strong>미래 매칭에만 적용</strong>됩니다 (이미 매칭된 보너스는 그대로).
                </p>
                <form id={`form-rule-${kid.id}`} action={updateSettings}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <SubmitButton variant="primary" pendingText="저장 중...">저장</SubmitButton>
                </form>
              </fieldset>

              <fieldset className="stack-3">
                <legend>💰 추가 입금</legend>
                <p className="soft" style={{ margin: 0 }}>
                  실험 영역에 입금하면 매칭 비율만큼 보너스도 함께 들어가요.
                </p>
                <form action={depositToKid} className="row gap-2">
                  <input type="hidden" name="accountId" value={account.id} />
                  <input type="number" name="amount" placeholder="금액" min={100} step={100} required style={{ flex: 1 }} />
                  <select name="zone">
                    <option value="free">자유 영역</option>
                    <option value="experiment">실험 영역 (보너스 매칭)</option>
                  </select>
                  <SubmitButton variant="warn" pendingText="입금 중...">입금</SubmitButton>
                </form>
              </fieldset>

              {account.cycle_status === 'active' && (
                <fieldset className="stack-3">
                  <legend>🔁 사이클 관리</legend>
                  <p className="soft" style={{ margin: 0 }}>
                    extend = 8주 너머 계속 / graduate = 잔액 동결 / reset = 새 사이클 (잔액 초기화, 과거 거래는 보존)
                  </p>
                  <form action={chooseCycleEnd} className="row gap-2">
                    <input type="hidden" name="accountId" value={account.id} />
                    <select name="action">
                      <option value="extend">계속 이어서 (extend)</option>
                      <option value="graduate">잔액 동결 (graduate)</option>
                      <option value="reset">새 사이클 시작 (reset)</option>
                    </select>
                    <input type="number" name="newStartingCapital" placeholder="reset 시 시작자금" min={1000} step={1000} style={{ flex: 1 }} />
                    <SubmitButton variant="primary" pendingText="실행 중..." style={{ background: '#9333ea' }}>실행</SubmitButton>
                  </form>
                </fieldset>
              )}
            </section>
          );
        })}
      </div>

      <p style={{ marginTop: 'var(--sp-5)', textAlign: 'center' }}><Link href="/guardian">← 대시보드로</Link></p>
    </main>
  );
}
