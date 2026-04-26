import { redirect } from 'next/navigation';
import { getGuardianFamilyView } from '@/lib/db/queries';
import { getSupabaseAdmin } from '@/lib/auth/admin';
import { updateSettings, depositToKid, chooseCycleEnd, timeWarp, addKid, resetKidLogin, updateFamilyTimezone } from './actions';
import { SubmitButton } from '@/lib/ui/submit-button';
import { TimezonePicker } from '@/lib/ui/timezone-picker';
import { CopyButton } from '@/lib/ui/copy-button';

export const dynamic = 'force-dynamic';

const WARP_LABEL: Record<string, string> = {
  advance_week: '⏩ 1주 앞으로 이동',
  rewind_week: '⏪ 1주 뒤로 이동',
  reset_today: '🔄 오늘로 리셋',
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ warped?: string; error?: string; pin_changed?: string; tz_changed?: string; login_reset?: string }> }) {
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

  // Fetch invite_token + login_id per kid (not in getGuardianFamilyView)
  const kidIds = (ctx.kids as Array<{ id: string }>).map((k) => k.id);
  const { data: kidMemberships } = kidIds.length
    ? await admin
        .from('memberships')
        .select('id, invite_token, login_id')
        .in('id', kidIds)
    : { data: [] };
  const kidLoginInfo = new Map<string, { invite_token: string | null; login_id: string | null }>();
  for (const km of (kidMemberships ?? []) as Array<{ id: string; invite_token: string | null; login_id: string | null }>) {
    kidLoginInfo.set(km.id, { invite_token: km.invite_token, login_id: km.login_id });
  }

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
          <div>자녀 PIN이 변경되었어요.</div>
        </div>
      )}
      {sp.login_reset && (
        <div className="alert alert-success fade-in" style={{ marginBottom: 'var(--sp-4)' }}>
          <span style={{ fontSize: '1.2rem' }}>🔑</span>
          <div>자녀 로그인 정보가 변경되었어요. 자녀에게 새 아이디/비번을 알려주세요.</div>
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

      <section className="card stack-3" style={{ marginBottom: 'var(--sp-5)' }}>
        <div>
          <h2 className="h3" style={{ margin: '0 0 4px' }}>➕ 자녀 추가</h2>
          <p className="muted" style={{ margin: 0, fontSize: '0.88rem' }}>
            새 자녀를 가족에 추가해요. 추가 후 통장 설계 (원금/방식/기간) wizard 가 시작됩니다.
          </p>
        </div>
        <form action={addKid} className="row gap-2" style={{ flexWrap: 'wrap' }}>
          <input
            type="text"
            name="displayName"
            placeholder="자녀 닉네임"
            required
            maxLength={20}
            style={{ flex: 1, minWidth: 140 }}
          />
          <select name="grade" required>
            <option value="5">5학년</option>
            <option value="6">6학년</option>
          </select>
          <SubmitButton variant="primary" pendingText="추가 중...">자녀 추가</SubmitButton>
        </form>
      </section>

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

              {(() => {
                const info = kidLoginInfo.get(kid.id);
                if (info?.invite_token) {
                  const inviteUrl = `https://moneybean.vercel.app/join/${info.invite_token}`;
                  return (
                    <fieldset className="stack-3" style={{ background: 'var(--bonus-bg)', borderColor: 'var(--bonus)' }}>
                      <legend>🔗 자녀 가입 링크</legend>
                      <p className="soft" style={{ margin: 0 }}>
                        자녀가 이 링크로 들어가서 본인 아이디/비밀번호를 만들어요.
                      </p>
                      <div style={{
                        background: 'white',
                        padding: 'var(--sp-3)',
                        borderRadius: 'var(--r-sm)',
                        wordBreak: 'break-all',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                      }}>
                        {inviteUrl}
                      </div>
                      <CopyButton value={inviteUrl} label="링크 복사" />
                    </fieldset>
                  );
                }
                if (info?.login_id) {
                  return (
                    <fieldset className="stack-3">
                      <legend>🔑 자녀 로그인 정보</legend>
                      <p className="soft" style={{ margin: 0 }}>
                        현재 아이디: <strong>{info.login_id}</strong>
                        <br />
                        잊었거나 바꾸고 싶으면 아래에 새로 입력하세요.
                      </p>
                      <form action={resetKidLogin} className="stack-2">
                        <input type="hidden" name="kidMembershipId" value={kid.id} />
                        <input
                          type="text"
                          name="newLoginId"
                          placeholder="새 아이디 (1-20자)"
                          minLength={1}
                          maxLength={20}
                          required
                          autoComplete="off"
                        />
                        <input
                          type="password"
                          name="newPassword"
                          placeholder="새 비밀번호 (4-8자)"
                          minLength={4}
                          maxLength={8}
                          required
                          autoComplete="new-password"
                        />
                        <SubmitButton variant="primary" pendingText="변경 중...">로그인 정보 리셋</SubmitButton>
                      </form>
                    </fieldset>
                  );
                }
                return null;
              })()}

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
