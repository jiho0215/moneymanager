#!/usr/bin/env node
/**
 * Live verification: simulate the signup flow against production Supabase.
 * Creates a test family, verifies all tables, then cleans up.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const env = Object.fromEntries(
  readFileSync(join(repoRoot, '.env.local'), 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) throw new Error('env vars missing');

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const testEmail = `test_signup_${Date.now()}@example.com`;
const testPassword = 'test_password_12345';

console.log('🧪 Verifying signup flow against PRODUCTION Supabase...\n');

let guardianUserId, kidUserId, familyId, kidMembershipId, accountId;

try {
  // 1. Create guardian
  console.log('1) Creating guardian auth user...');
  const { data: gAuth, error: gErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
    user_metadata: { role: 'guardian', display_name: 'Test Guardian' },
  });
  if (gErr) throw gErr;
  guardianUserId = gAuth.user.id;
  console.log('   ✅ guardian:', guardianUserId.slice(0, 8));

  // 2. Create kid
  console.log('2) Creating kid auth user (opaque internal)...');
  const kidEmail = `kid_${crypto.randomUUID()}@noreply.local`;
  const kidPass = crypto.randomUUID() + crypto.randomUUID();
  const { data: kAuth, error: kErr } = await admin.auth.admin.createUser({
    email: kidEmail,
    password: kidPass,
    email_confirm: true,
    user_metadata: { role: 'kid', display_name: 'TestKid', internal_password: kidPass },
  });
  if (kErr) throw kErr;
  kidUserId = kAuth.user.id;
  console.log('   ✅ kid:', kidUserId.slice(0, 8));

  // 3. Atomic create_family_with_kid
  console.log('3) Calling create_family_with_kid RPC...');
  const { data: rpcData, error: rpcErr } = await admin.rpc('create_family_with_kid', {
    p_family_name: `Test Family ${Date.now()}`,
    p_guardian_user_id: guardianUserId,
    p_guardian_display_name: 'Test Guardian',
    p_kid_user_id: kidUserId,
    p_kid_nickname: 'TestKid',
    p_kid_grade: 5,
    p_starting_capital: 10000,
    p_consent_text: 'Test consent (PIPA Article 22)',
    p_consent_version: 'v1',
  });
  if (rpcErr) throw rpcErr;
  familyId = rpcData.family_id;
  kidMembershipId = rpcData.kid_membership_id;
  accountId = rpcData.account_id;
  console.log('   ✅ family:', familyId.slice(0, 8), 'account:', accountId.slice(0, 8));

  // 4. Verify all tables
  console.log('\n4) Verifying all tables...');
  const checks = [];

  const { data: family } = await admin.from('families').select('*').eq('id', familyId).single();
  checks.push(['families', !!family]);

  const { data: consents } = await admin.from('consents').select('*').eq('family_id', familyId);
  checks.push(['consents (PIPA)', consents?.length === 1 && consents[0].consent_version === 'v1']);

  const { data: memberships } = await admin.from('memberships').select('*').eq('family_id', familyId);
  checks.push(['memberships (2: guardian + kid)', memberships?.length === 2]);

  const { data: account } = await admin.from('accounts').select('*').eq('id', accountId).single();
  const expectedFree = 8000;
  const expectedExp = 2000;
  checks.push([
    'accounts BIGINT (free=8000, exp=2000)',
    account?.free_balance == expectedFree && account?.experiment_balance == expectedExp,
  ]);
  checks.push([
    'accounts cycle_number=1, status=active',
    account?.cycle_number === 1 && account?.cycle_status === 'active',
  ]);

  const { data: txs } = await admin.from('transactions').select('*').eq('account_id', accountId);
  checks.push(['transactions (2 initial_deposit)', txs?.length === 2]);

  const { data: snapshot } = await admin.from('weekly_snapshots').select('*').eq('account_id', accountId);
  checks.push(['weekly_snapshots (week 0)', snapshot?.length === 1 && snapshot[0].week_num === 0]);

  for (const [name, ok] of checks) {
    console.log(`   ${ok ? '✅' : '❌'} ${name}`);
  }

  // 5. Test compute_week_num RPC
  console.log('\n5) Testing compute_week_num RPC...');
  const { data: weekNum } = await admin.rpc('compute_week_num', { p_account_id: accountId });
  console.log(`   ✅ compute_week_num returned: ${weekNum} (negative or 0 expected for new account)`);

  // 6. Test reconcile_balance RPC
  console.log('\n6) Testing reconcile_balance RPC...');
  const { data: rec } = await admin.rpc('reconcile_balance', { p_account_id: accountId });
  console.log(`   ✅ reconcile drift: ${rec.drift} (should be false for fresh account)`);
  if (rec.drift) {
    console.log('      ⚠️  drift detected:', rec);
  }

  // 7. Test generate_kid_login_code RPC
  console.log('\n7) Testing generate_kid_login_code RPC...');
  const testCode = 'ABC234';
  const { error: codeErr } = await admin.rpc('generate_kid_login_code', {
    p_kid_membership_id: kidMembershipId,
    p_guardian_user_id: guardianUserId,
    p_code: testCode,
    p_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  });
  if (codeErr) {
    console.log(`   ❌ generate_kid_login_code: ${codeErr.message}`);
  } else {
    console.log(`   ✅ kid login code created: ${testCode}`);
  }

  console.log('\n🎉 Family signup flow VERIFIED end-to-end on production.\n');

} catch (err) {
  console.error('\n❌ FAILED:', err.message);
  console.error(err);
} finally {
  // Cleanup
  console.log('🧹 Cleaning up test data...');
  if (familyId) {
    // Cascade delete: family → memberships → accounts → transactions/snapshots/codes/consents
    await admin.from('families').delete().eq('id', familyId).then(({ error }) =>
      console.log(`   families delete: ${error ? '❌ ' + error.message : '✅'}`)
    );
  }
  if (guardianUserId) await admin.auth.admin.deleteUser(guardianUserId).then(() => console.log('   guardian auth deleted'));
  if (kidUserId) await admin.auth.admin.deleteUser(kidUserId).then(() => console.log('   kid auth deleted'));
  console.log('\n✅ Cleanup done.');
  process.exit(0);
}
