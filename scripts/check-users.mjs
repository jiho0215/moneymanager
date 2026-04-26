#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
    .split('\n').filter(l => l && !l.startsWith('#') && l.includes('='))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
const isTest = (u) => u.email && (
  u.email.includes('test_form_') || u.email.includes('trace_') || u.email.includes('e2e_') ||
  u.email.includes('test_signup_') || u.email.includes('TEST_INT_') ||
  (u.email.includes('@noreply.local') && !u.user_metadata?.display_name)
);
const real = (data?.users ?? []).filter(u => !isTest(u));
const tests = (data?.users ?? []).filter(isTest);
console.log('Real users:', real.length);
real.forEach(u => console.log('  -', u.email, '|role:', u.user_metadata?.role || '-', '|name:', u.user_metadata?.display_name || '-', '|id:', u.id.slice(0, 8)));
console.log('\nTest users:', tests.length);
tests.forEach(u => console.log('  -', u.email));
if (process.argv.includes('--clean-tests')) {
  for (const u of tests) {
    await admin.auth.admin.deleteUser(u.id).catch(() => {});
  }
  console.log('\nDeleted', tests.length, 'test users');
}
