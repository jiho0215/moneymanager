---
epicId: compound-learning-elementary
ticketId: T2-auth-family
status: planned
implBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "needs schema (consents, accounts, memberships), create_family_with_kid RPC, RLS policies"
deployBlockedBy:
  - ticketId: T1-foundation
    kind: hard
    reason: "T1 deployment provides DB schema and RPC functions T2 depends on"
createdAt: 2026-04-25T00:00:00Z
---

# T2-auth-family — Auth + Family Creation + PIPA Consent + Kid Code Login

## §1 Back-reference

Part of epic [compound-learning-elementary](spike-plan.md). See [spike-plan §7](spike-plan.md#7-tickets) for sibling tickets and current status.

## §2 This Ticket's Role in the Big Picture

T2 는 **보호자 가입 + 자녀 등록 + PIPA 동의 + 자녀 무가입 로그인**을 하나의 atomic 흐름으로 만든다. 자녀가 본인 이메일/비밀번호를 만들지 않는다는 결정으로 PIPA Article 22 (만 14세 미만 법정대리인 동의) 부담이 보호자 한 사람에게 깔끔히 집중된다.

이 티켓이 머지되면:
- 보호자 1명이 가입할 때 PIPA 동의 텍스트/버전/timestamp가 `consents` row로 영구 보존
- 가족 + 보호자 membership + 자녀 membership + 자녀 account가 **단일 Postgres transaction (RPC `create_family_with_kid`)** 으로 생성
- 보호자가 보호자 dashboard에서 "자녀 로그인 코드" 발급 가능 (24시간 TTL)
- 자녀가 코드 입력 → 서버가 internal credentials 로 변환 → Supabase 세션 발급
- 30분 비활성 시 자녀 세션 자동 만료 (T1.3.3 보안 위협 모델)

이게 안 되면 T4 (자녀 dashboard) 와 T5 (claim flow) 가 RLS 컨텍스트 (auth.uid()) 없이 진행 불가능.

## §3 Relevant API Contract Slice

### Server Actions

```typescript
// app/(auth)/signup/actions.ts
async function createFamily(input: {
  guardianEmail: string;
  guardianPassword: string;
  consentText: string;        // 전체 텍스트 (사용자 화면 표시 동일)
  consentVersion: string;     // 'v1', ...
  kidNickname: string;
  kidGrade: 5 | 6;
  startingCapital: number;    // KRW BIGINT
}): Promise<
  | { ok: true; familyId: string; kidAccountId: string }
  | { ok: false; reason: 'email_taken' | 'invalid_consent' | 'invalid_input' }
>;

// app/(guardian)/kid-access/actions.ts
async function generateKidLoginCode(input: {
  kidMembershipId: string;
}): Promise<
  | { ok: true; code: string; expiresAt: string }   // 6 chars, 24h TTL
  | { ok: false; reason: 'unauthorized' | 'kid_not_found' }
>;

// app/(auth)/kid-login/actions.ts
async function loginAsKidWithCode(input: {
  code: string;
}): Promise<
  | { ok: true; sessionToken: string; redirect: '/dashboard' }
  | { ok: false; reason: 'invalid_code' | 'expired_code' | 'rate_limited' }
>;

// app/(auth)/logout/actions.ts
async function logout(): Promise<{ ok: true }>;
```

### Postgres RPC

`create_family_with_kid` 는 T1에서 정의됨. T2 는 호출만 함:

```typescript
const { data, error } = await supabaseAdmin.rpc('create_family_with_kid', {
  p_guardian_email: guardianEmail,
  p_guardian_user_id: createdAuthUser.id,    // Supabase Auth가 먼저 user 생성
  p_kid_internal_email: `kid_${uuid()}@noreply.local`,
  p_kid_internal_user_id: createdKidAuthUser.id,
  p_kid_nickname: kidNickname,
  p_kid_grade: kidGrade,
  p_starting_capital: startingCapital,
  p_consent_text: consentText,
  p_consent_version: consentVersion,
});
```

`create_family_with_kid` 는 한 transaction 안에서:
1. INSERT `families`
2. INSERT `consents` (보호자 동의 evidence)
3. INSERT `memberships` (guardian role)
4. INSERT `memberships` (kid role)
5. INSERT `accounts` (자녀 1개, BIGINT 잔액 0, free=80%, experiment=20%, bonus=0; epoch_kst=다음 월요일 00:00 KST)
6. INSERT `transactions` (`initial_deposit` 두 row: free 80%, experiment 20%)

원자성: 어느 한 step 실패 시 전체 rollback.

## §4 Relevant Migrations

T2 는 새 migration owner는 아니지만 다음 보강 필요:

| # | 변경 | 비고 |
|---|---|---|
| 011 | seed: dev 가족 + 자녀 (development only) | T2 owner. `create_family_with_kid` 직접 호출 |
| 012 | `kid_login_codes` 테이블 추가 | T2 owner. `code TEXT PK`, `kid_membership_id UUID FK`, `expires_at TIMESTAMPTZ`, `used_at TIMESTAMPTZ NULL`, `created_by_guardian_id UUID FK`, RLS: guardian-only INSERT, kid login flow은 service-role 사용 (이 1군데만 예외) |

`kid_login_codes` 테이블 정책:
- 보호자: 자기 가족 자녀에 대해 INSERT 가능 + SELECT 가능
- 자녀: 직접 SELECT 불가 (kid 로그인 흐름이 service_role로 검증)
- code 자체는 6자 random (혼동 문자 제외: `0`, `O`, `I`, `l`, `1` 제외, 32 chars × 6 positions ≈ 1B 조합)
- 코드 사용 후 `used_at` 기록, 재사용 불가

## §5 Relevant Observability Hooks

### Metrics (T2 owner)
- `auth.signup_total` — 보호자 가입 시도
- `auth.signup_succeeded_total`
- `auth.kid_code_generated_total`
- `auth.kid_code_used_total`
- `auth.kid_code_failed_total` — 잘못된/만료 코드 시도

### Logs

`createFamily` Server Action:
```json
{
  "action": "createFamily",
  "actor_role": "guardian",
  "consent_version": "v1",
  "kid_grade": 5,
  "starting_capital": 10000,
  "success": true
}
```

PIPA-relevant: consent text/version은 **로그에 안 남김** (DB에만). 로그에는 version만.

자녀 로그인:
```json
{
  "action": "loginAsKidWithCode",
  "actor_role": "anon",   // 코드 사용 시점에는 아직 자녀 세션 없음
  "code_hash": "sha256[:8]",  // raw code 절대 X
  "success": true
}
```

### Alerts (T2 owner)
- `auth.kid_code_failed_total` > 10/hour → 보안 alarm (brute-force 시도 가능성)
- `auth.signup_total` 가 갑자기 급증 → 비정상 (가족 1팀 MVP, 정상은 0/hr)

### Rate Limiting
- `loginAsKidWithCode`: IP당 분당 5회 → middleware로 강제. 초과 시 `rate_limited`.

## §6 Implementation Notes

<!-- BEGIN AUTO-GENERATED IMPL LOG -->
_(populated by /implement)_
<!-- END AUTO-GENERATED IMPL LOG -->

## §7 Discoveries / Reference-doc Corrections

_(empty until /implement runs)_

---

## Acceptance Criteria

- [ ] 보호자 가입 화면에서 PIPA 동의 체크박스 미체크 시 폼 제출 거부
- [ ] 가입 성공 시 `consents` 테이블에 row 존재 (text/version/timestamp)
- [ ] `create_family_with_kid` RPC가 atomic — 어느 step 실패 시 family/consent/membership/account/transactions 전부 rollback (integration test)
- [ ] 자녀 로그인 코드 발급 → 6자 random, 24h TTL, 1회 사용 후 invalidate
- [ ] 자녀 코드로 로그인 시 자녀 user의 Supabase 세션 발급, JWT의 `role` claim = `'kid'`, `family_id` claim 포함
- [ ] 자녀 화면 30분 비활성 시 자동 logout (E2E test)
- [ ] 자녀 코드 brute-force (10회 실패/hour) → alarm
- [ ] migration 011 (dev seed), 012 (kid_login_codes) UP/DOWN reversibility CI 통과
- [ ] E2E: 보호자 가입 (consent) → 자녀 코드 발급 → 자녀 로그인 → role 기반 redirect 확인 (kid → /dashboard placeholder)
- [ ] integration test: 자녀 JWT로 다른 가족의 데이터 SELECT → 0 rows (RLS 검증)
- [ ] PII minimization 검증: 자녀의 `auth.users.email` 은 `kid_*@noreply.local` 형식, 사용자 화면에 절대 노출 안 됨
- [ ] 5명의 multi-agent review 통과

## Estimated Complexity

중간. T1 위에 얇게 얹힘. 가장 까다로운 부분은:
- 자녀 코드 → Supabase 세션 발급의 server-side 로직 (service_role 사용 1곳 예외)
- 30분 inactivity timeout (Supabase Auth refresh token 정책 + client-side timer)
- atomic family creation rollback 검증
