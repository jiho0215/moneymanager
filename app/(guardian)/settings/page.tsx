import { getGuardianFamilyView } from '@/lib/db/queries';
import { redirect } from 'next/navigation';
import { updateSettings, depositToKid, chooseCycleEnd } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');

  return (
    <main style={{ maxWidth: '720px', margin: '0 auto', padding: '24px' }}>
      <h1>⚙️ 가족 설정</h1>

      {ctx.kids.map((k) => {
        const kid = k as { id: string; display_name: string };
        const account = (ctx.accounts as Array<{ id: string; membership_id: string; weekly_growth_rate_bp: number; bonus_match_rate_bp: number; weekly_deadline_dow: number; cycle_status: string; cycle_number: number }>).find((a) => String(a.membership_id) === String(kid.id));
        if (!account) return null;
        return (
          <section key={kid.id} style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <h2 style={{ marginTop: 0 }}>{kid.display_name}</h2>

            <form action={updateSettings} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '1.5rem' }}>
              <input type="hidden" name="accountId" value={account.id} />
              <label>
                매칭 비율 (basis points: 2000 = 20%)
                <input type="number" name="bonusMatchRateBp" defaultValue={account.bonus_match_rate_bp} min={0} max={10000} step={100} required style={{ display: 'block', width: '100%', padding: '8px' }} />
              </label>
              <label>
                주간 청구 마감 요일 (0=일~6=토)
                <input type="number" name="weeklyDeadlineDow" defaultValue={account.weekly_deadline_dow} min={0} max={6} required style={{ display: 'block', width: '100%', padding: '8px' }} />
              </label>
              <p style={{ fontSize: '0.85rem', color: '#666', margin: 0 }}>
                참고: 매칭 비율 변경은 미래 매칭에만 적용됩니다 (이미 매칭된 보너스는 그대로).
              </p>
              <SubmitButton variant="primary" pendingText="저장 중..." style={{ padding: '10px' }}>
                저장
              </SubmitButton>
            </form>

            <h3 style={{ marginTop: 0 }}>💰 추가 입금</h3>
            <form action={depositToKid} style={{ display: 'flex', gap: '8px', marginBottom: '1.5rem' }}>
              <input type="hidden" name="accountId" value={account.id} />
              <input type="number" name="amount" placeholder="금액" min={100} step={100} required style={{ flex: 1, padding: '8px' }} />
              <select name="zone" style={{ padding: '8px' }}>
                <option value="free">자유 영역</option>
                <option value="experiment">실험 영역 (보너스 매칭)</option>
              </select>
              <SubmitButton variant="warn" pendingText="입금 중..." style={{ padding: '8px 16px' }}>
                입금
              </SubmitButton>
            </form>

            {account.cycle_status === 'active' && (
              <>
                <h3 style={{ marginTop: 0 }}>🔁 사이클 (현재 {account.cycle_number})</h3>
                <form action={chooseCycleEnd} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <select name="action" style={{ padding: '8px' }}>
                    <option value="extend">계속 이어서 (extend)</option>
                    <option value="graduate">잔액 동결 (graduate)</option>
                    <option value="reset">새 사이클 시작 (reset)</option>
                  </select>
                  <input type="number" name="newStartingCapital" placeholder="reset 시 시작자금" min={1000} step={1000} style={{ padding: '8px', flex: 1 }} />
                  <SubmitButton variant="primary" pendingText="실행 중..." style={{ padding: '8px 16px', backgroundColor: '#9333ea' }}>
                    실행
                  </SubmitButton>
                </form>
              </>
            )}
          </section>
        );
      })}

      <p style={{ marginTop: '2rem', textAlign: 'center' }}><a href="/guardian">← 대시보드로</a></p>
    </main>
  );
}
