import { redirect } from 'next/navigation';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { updateSettings, depositToKid, chooseCycleEnd, timeWarp, changeKidPin, updateFamilyTimezone } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';
import { TimezonePicker } from '@/lib/ui/timezone-picker';

export const dynamic = 'force-dynamic';

const WARP_LABEL: Record<string, string> = {
  advance_week: '⏩ 1주 앞으로 이동',
  rewind_week: '⏪ 1주 뒤로 이동',
  reset_today: '🔄 오늘로 리셋',
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ warped?: string; error?: string; pin_changed?: string; tz_changed?: string }> }) {
  const ctx = await getGuardianFamilyView();
  if (!ctx) redirect('/login');
  const sp = await searchParams;

  const admin = getSupabaseAdmin();
  const { data: family } = await admin
    .from('families')
    .select('id, name, timezone')
    .eq('id', (ctx.guardian as { family_id: string }).family_id)
    .single();
  const fam = family as { id: string; name: string; timezone: string } | null;

  return (
    <main className="page">
      <h1 className="h1" style={{ marginBottom: 'var(--sp-5)' }}>⚙️ 가족 설정</h1>

      {sp.error && (
        <div className="alert alert-error fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <div>{decodeURIComponent(sp.error)}</div>
        </div>
      )}
      {sp.warped && (
        <div className="alert alert-success fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>🕰</span>
          <div>{WARP_LABEL[sp.warped] ?? sp.warped} 적용됨. dashboard에서 새 잔액 확인 가능.</div>
        </div>
      )}
      {sp.pin_changed && (
        <div className="alert alert-success fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>🔒</span>
          <div>자녀 PIN이 변경되었어요. 다음 로그인부터 새 PIN으로 들어가야 해요.</div>
        </div>
      )}
      {sp.tz_changed && (
        <div className="alert alert-success fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>🌏</span>
          <div>가족 시간대가 변경되었어요.</div>
        </div>
      )}

      {fam && (
        <section className="card stack-3" style={{ marginBottom: 'var(--sp-5)' }}>
          <div>
            <h2 className="h3" style={{ margin: '0 0 4px' }}>🌏 가족 시간대</h2>
            <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
              청구일, 사이클 시작일 등 모든 날짜가 이 시간대 기준으로 진행됩니다. 현재 설정: <strong>{fam.timezone}</strong>
            </p>
          </div>
          <form action={updateFamilyTimezone} className="row gap-2">
            <input type="hidden" name="familyId" value={fam.id} />
            <div style={{ flex: 1 }}>
              <TimezonePicker name="timezone" defaultValue={fam.timezone} />
            </div>
            <SubmitButton variant="primary" pendingText="변경 중...">변경</SubmitButton>
          </form>
        </section>
      )}

      <div className="stack-5">
        {ctx.kids.map((k) => {
          const kid = k as { id: string; display_name: string };
          const account = (ctx.accounts as Array<{ id: string; membership_id: string; weekly_deadline_dow: number; cycle_status: string; cycle_number: number }>).find((a) => String(a.membership_id) === String(kid.id));
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
                  주간 청구 마감 요일 <span className="soft">(0=일~6=토)</span>
                  <input type="number" form={`form-rule-${kid.id}`} name="weeklyDeadlineDow" defaultValue={account.weekly_deadline_dow} min={0} max={6} required />
                </label>
                <form id={`form-rule-${kid.id}`} action={updateSettings}>
                  <input type="hidden" name="accountId" value={account.id} />
                  <SubmitButton variant="primary" pendingText="저장 중...">저장</SubmitButton>
                </form>
              </fieldset>

              <fieldset className="stack-3">
                <legend>🔒 자녀 PIN 변경</legend>
                <p className="soft" style={{ margin: 0 }}>
                  자녀가 로그인할 때 쓰는 4자리 PIN을 바꿉니다. 변경 후 자녀에게 새 PIN을 알려주세요.
                </p>
                <form action={changeKidPin} className="row gap-2">
                  <input type="hidden" name="kidMembershipId" value={kid.id} />
                  <input
                    type="text"
                    name="newPin"
                    placeholder="새 PIN (숫자 4자리)"
                    inputMode="numeric"
                    pattern="\d{4}"
                    maxLength={4}
                    minLength={4}
                    required
                    autoComplete="off"
                    style={{
                      flex: 1,
                      fontFamily: 'monospace',
                      letterSpacing: '0.4em',
                      fontSize: '1.1rem',
                      textAlign: 'center',
                    }}
                  />
                  <SubmitButton variant="primary" pendingText="변경 중...">PIN 변경</SubmitButton>
                </form>
              </fieldset>

              <fieldset className="stack-3">
                <legend>💰 통장 입금</legend>
                <p className="soft" style={{ margin: 0 }}>
                  자녀 통장에 원금을 추가해요. 입금한 돈도 매주 청구하면 함께 자랍니다.
                </p>
                <form action={depositToKid} className="row gap-2">
                  <input type="hidden" name="accountId" value={account.id} />
                  <input type="number" name="amount" placeholder="금액" min={100} step={100} required style={{ flex: 1 }} />
                  <SubmitButton variant="warn" pendingText="입금 중...">입금</SubmitButton>
                </form>
              </fieldset>

              <fieldset className="stack-3" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #ddd6fe 100%)', borderColor: '#9333ea' }}>
                <legend>🕰 시간 여행 <span className="soft" style={{ fontWeight: 400 }}>(데모/테스트)</span></legend>
                <p className="soft" style={{ margin: 0 }}>
                  실제 1주를 안 기다리고 시간을 앞당기거나 되돌릴 수 있어요. 자녀에게 8주 후 모습 미리 보여줄 때 유용.
                </p>
                <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
                  <form action={timeWarp}>
                    <input type="hidden" name="accountId" value={account.id} />
                    <input type="hidden" name="action" value="advance_week" />
                    <SubmitButton variant="success" pendingText="이동 중...">⏩ 1주 앞으로</SubmitButton>
                  </form>
                  <form action={timeWarp}>
                    <input type="hidden" name="accountId" value={account.id} />
                    <input type="hidden" name="action" value="rewind_week" />
                    <SubmitButton variant="subtle" pendingText="이동 중...">⏪ 1주 뒤로</SubmitButton>
                  </form>
                  <form action={timeWarp}>
                    <input type="hidden" name="accountId" value={account.id} />
                    <input type="hidden" name="action" value="reset_today" />
                    <SubmitButton variant="warn" pendingText="리셋 중...">🔄 오늘로 리셋</SubmitButton>
                  </form>
                </div>
                <p className="soft" style={{ margin: 0, fontSize: '0.85rem' }}>
                  💡 시간을 앞당긴 후 자녀가 청구하면 진짜로 잔액이 자라요. 데모 후 &lsquo;오늘로 리셋&rsquo;으로 돌아오면 됩니다.
                </p>
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

    </main>
  );
}
