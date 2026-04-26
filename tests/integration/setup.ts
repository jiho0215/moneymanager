/**
 * Integration test setup — connects to live Supabase via env vars.
 * Tests create test families with `Test Family TEST_` prefix and cleanup at end.
 *
 * Usage:
 *   npm run test:integration
 *
 * Requires SUPABASE_APP_DB_URL + SUPABASE_SERVICE_ROLE_KEY in env (loaded from .env.local).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';

function loadEnv(): Record<string, string> {
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return process.env as Record<string, string>;
  const env = { ...(process.env as Record<string, string>) };
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const idx = line.indexOf('=');
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

const env = loadEnv();

export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
export const SUPABASE_APP_DB_URL = env.SUPABASE_APP_DB_URL;

export function getAdminClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('admin env missing');
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function getAnonClient(): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('anon env missing');
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function getPgClient(): Promise<pg.Client> {
  if (!SUPABASE_APP_DB_URL) throw new Error('app db url missing');
  const m = SUPABASE_APP_DB_URL.match(/^postgresql:\/\/([^:]+):(.+)@([^:\/]+):(\d+)\/(.+)$/);
  if (!m) throw new Error('cannot parse db url');
  const [, u, p, h, port, db] = m;
  const client = new pg.Client({
    user: u, password: p!, host: h, port: Number(port), database: db,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

export type CreatedFamily = {
  guardianUserId: string;
  guardianEmail: string;
  guardianPassword: string;
  kidUserId: string;
  kidEmail: string;
  kidPassword: string;
  familyId: string;
  kidMembershipId: string;
  accountId: string;
};

const TEST_PREFIX = 'TEST_INT_';

export async function createTestFamily(opts?: { startingCapital?: number }): Promise<CreatedFamily> {
  const admin = getAdminClient();
  const stamp = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const guardianEmail = `${TEST_PREFIX}guardian_${stamp}@example.test`;
  const guardianPassword = 'GuardianPass_12345';
  const kidEmail = `${TEST_PREFIX}kid_${stamp}@noreply.local`;
  const kidPassword = 'KidPass_' + crypto.randomUUID();

  const { data: g } = await admin.auth.admin.createUser({
    email: guardianEmail,
    password: guardianPassword,
    email_confirm: true,
    user_metadata: { role: 'guardian', display_name: 'Test Guardian' },
  });
  if (!g?.user) throw new Error('guardian create failed');

  const { data: k } = await admin.auth.admin.createUser({
    email: kidEmail,
    password: kidPassword,
    email_confirm: true,
    user_metadata: { role: 'kid', display_name: 'TestKid', internal_password: kidPassword },
  });
  if (!k?.user) throw new Error('kid create failed');

  const { data, error } = await admin.rpc('create_family_with_kid', {
    p_family_name: `Test Family ${TEST_PREFIX}${stamp}`,
    p_guardian_user_id: g.user.id,
    p_guardian_display_name: 'Test Guardian',
    p_kid_user_id: k.user.id,
    p_kid_nickname: 'TestKid',
    p_kid_grade: 5,
    p_starting_capital: opts?.startingCapital ?? 10000,
    p_consent_text: 'TEST consent',
    p_consent_version: 'v1',
  });
  if (error) throw error;

  return {
    guardianUserId: g.user.id,
    guardianEmail,
    guardianPassword,
    kidUserId: k.user.id,
    kidEmail,
    kidPassword,
    familyId: data.family_id,
    kidMembershipId: data.kid_membership_id,
    accountId: data.account_id,
  };
}

export async function cleanupAllTestData(): Promise<void> {
  const admin = getAdminClient();
  const pgc = await getPgClient();

  try {
    await pgc.query('BEGIN');
    await pgc.query('ALTER TABLE consents DISABLE TRIGGER consents_no_delete');
    await pgc.query('ALTER TABLE transactions DISABLE TRIGGER transactions_no_delete');
    await pgc.query(`DELETE FROM families WHERE name LIKE 'Test Family ${TEST_PREFIX}%'`);
    await pgc.query('ALTER TABLE consents ENABLE TRIGGER consents_no_delete');
    await pgc.query('ALTER TABLE transactions ENABLE TRIGGER transactions_no_delete');
    await pgc.query('COMMIT');
  } catch (e) {
    await pgc.query('ROLLBACK');
    throw e;
  } finally {
    await pgc.end();
  }

  // Clean up test auth users (any user with TEST_INT_ prefix)
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (users?.users) {
    for (const u of users.users) {
      if (u.email?.includes(TEST_PREFIX)) {
        await admin.auth.admin.deleteUser(u.id).catch(() => {});
      }
    }
  }
}
