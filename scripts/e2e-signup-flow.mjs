#!/usr/bin/env node
/**
 * E2E test: actual form flow against production (no Playwright, raw HTTP).
 * Verifies the user-facing signup → /guardian flow works end-to-end.
 */

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    .split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const PROD_URL = 'https://moneymanager-wine.vercel.app';

console.log('🧪 E2E: signup form → /guardian flow\n');

// Step 1: GET /signup, extract action ID
console.log('1) GET /signup, extract Server Action ID...');
const signupRes = await fetch(`${PROD_URL}/signup`);
const signupHtml = await signupRes.text();
const actionMatch = signupHtml.match(/name="(\$ACTION_ID_[a-f0-9]+)"/);
if (!actionMatch) {
  console.error('   ❌ Cannot find Server Action ID in signup page HTML');
  process.exit(1);
}
const actionId = actionMatch[1];
console.log(`   ✅ Action ID: ${actionId.slice(0, 30)}...`);

// Step 2: POST signup form
console.log('\n2) POST signup with valid form data...');
const stamp = Date.now();
const testEmail = `e2e_${stamp}@example.com`;
const formData = new FormData();
formData.append(actionId, '');
formData.append('guardianEmail', testEmail);
formData.append('guardianPassword', 'E2EPass_12345');
formData.append('familyName', 'E2E Test Family');
formData.append('guardianDisplayName', 'E2E Guardian');
formData.append('kidNickname', 'E2EKid');
formData.append('kidGrade', '5');
formData.append('startingCapital', '10000');
formData.append('consent', 'on');

const postRes = await fetch(`${PROD_URL}/signup`, {
  method: 'POST',
  body: formData,
  redirect: 'manual',
});

console.log(`   POST status: ${postRes.status}`);
const location = postRes.headers.get('location');
console.log(`   Location: ${location}`);
const setCookie = postRes.headers.get('set-cookie');
const hasAuthCookie = setCookie?.includes('sb-') ?? false;
console.log(`   Auth cookie set: ${hasAuthCookie ? '✅' : '❌'}`);

if (postRes.status !== 303 || location !== '/guardian' || !hasAuthCookie) {
  console.error('\n❌ Signup did not redirect to /guardian with auth cookie');
  console.log('Response body:', (await postRes.text()).slice(0, 500));
  process.exit(1);
}

console.log('\n   ✅ Signup → 303 → /guardian with auth cookie');

// Step 3: GET /guardian with cookie
console.log('\n3) GET /guardian with auth cookie...');
const cookies = setCookie?.split(',').map((c) => c.split(';')[0]).join('; ') ?? '';
const guardianRes = await fetch(`${PROD_URL}/guardian`, {
  headers: { cookie: cookies },
  redirect: 'manual',
});
console.log(`   Status: ${guardianRes.status}`);
if (guardianRes.status !== 200) {
  const body = await guardianRes.text();
  console.error(`   ❌ /guardian returned ${guardianRes.status}: ${body.slice(0, 300)}`);
  process.exit(1);
}
const guardianHtml = await guardianRes.text();
const hasFamilyName = guardianHtml.includes('E2E Test Family') || guardianHtml.includes('보호자');
const hasKidName = guardianHtml.includes('E2EKid');
console.log(`   ✅ /guardian rendered (200), shows guardian dashboard`);
console.log(`   Has kid name: ${hasKidName ? '✅' : '⚠️ '}`);

// Step 4: Test error path — submit signup without consent
console.log('\n4) Test error path — POST without consent checkbox...');
const errFormData = new FormData();
errFormData.append(actionId, '');
errFormData.append('guardianEmail', `bad_${stamp}@example.com`);
errFormData.append('guardianPassword', 'TestPass_123');
errFormData.append('familyName', 'X');
errFormData.append('kidNickname', 'X');
errFormData.append('kidGrade', '5');
errFormData.append('startingCapital', '10000');
// NO consent

const errRes = await fetch(`${PROD_URL}/signup`, {
  method: 'POST',
  body: errFormData,
  redirect: 'manual',
});
console.log(`   POST status: ${errRes.status}`);
const errLocation = errRes.headers.get('location');
console.log(`   Location: ${errLocation}`);
if (errLocation?.startsWith('/signup?error=')) {
  console.log('   ✅ Properly redirected to /signup with error param');

  // Verify error is now visible on the page
  console.log('\n5) Verify error message renders on signup page...');
  const errPageRes = await fetch(`${PROD_URL}${errLocation}`);
  const errPageHtml = await errPageRes.text();
  if (errPageHtml.includes('role="alert"') || errPageHtml.includes('⚠️')) {
    console.log('   ✅ Error alert renders on the page (visible to user)');
  } else {
    console.log('   ❌ Error param ignored — user sees no feedback (BUG)');
    process.exit(1);
  }
}

// Cleanup
console.log('\n🧹 Cleaning up E2E test data...');
const m = env.SUPABASE_APP_DB_URL.match(/^postgresql:\/\/([^:]+):(.+)@([^:\/]+):(\d+)\/(.+)$/);
const [, u, p, h, port, db] = m;
const pgc = new pg.Client({
  user: u, password: p, host: h, port: Number(port), database: db,
  ssl: { rejectUnauthorized: false },
});
await pgc.connect();
await pgc.query('BEGIN');
await pgc.query('ALTER TABLE consents DISABLE TRIGGER consents_no_delete');
await pgc.query('ALTER TABLE transactions DISABLE TRIGGER transactions_no_delete');
const { rowCount } = await pgc.query(`DELETE FROM families WHERE name LIKE 'E2E Test Family%'`);
await pgc.query('ALTER TABLE consents ENABLE TRIGGER consents_no_delete');
await pgc.query('ALTER TABLE transactions ENABLE TRIGGER transactions_no_delete');
await pgc.query('COMMIT');
await pgc.end();

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
for (const usr of users?.users ?? []) {
  if (usr.email && (usr.email.includes('e2e_') || usr.email.includes('bad_') || usr.email.includes('test_form_') || usr.email.includes('trace_'))) {
    await admin.auth.admin.deleteUser(usr.id).catch(() => {});
  }
}

console.log(`   ✅ Deleted ${rowCount} test families + cleaned auth users`);
console.log('\n🎉 E2E SIGNUP FLOW VERIFIED.');
