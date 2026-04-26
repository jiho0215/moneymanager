import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  createTestFamily,
  cleanupAllTestData,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  type CreatedFamily,
} from './setup';

describe('RLS — cross-family isolation', () => {
  let famA: CreatedFamily;
  let famB: CreatedFamily;

  beforeAll(async () => {
    await cleanupAllTestData();
    famA = await createTestFamily();
    famB = await createTestFamily();
  }, 60000);

  afterAll(async () => {
    await cleanupAllTestData();
  }, 60000);

  async function asUser(email: string, password: string) {
    const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return client;
  }

  it('guardian A cannot SELECT family B accounts', async () => {
    const aClient = await asUser(famA.guardianEmail, famA.guardianPassword);
    const { data } = await aClient.from('accounts').select('*').eq('id', famB.accountId);
    expect(data?.length ?? 0).toBe(0);
  }, 30000);

  it('guardian A cannot SELECT family B transactions', async () => {
    const aClient = await asUser(famA.guardianEmail, famA.guardianPassword);
    const { data } = await aClient.from('transactions').select('*').eq('account_id', famB.accountId);
    expect(data?.length ?? 0).toBe(0);
  }, 30000);

  it('guardian A cannot SELECT family B memberships', async () => {
    const aClient = await asUser(famA.guardianEmail, famA.guardianPassword);
    const { data } = await aClient.from('memberships').select('*').eq('family_id', famB.familyId);
    expect(data?.length ?? 0).toBe(0);
  }, 30000);

  it('guardian A cannot SELECT family B consents', async () => {
    const aClient = await asUser(famA.guardianEmail, famA.guardianPassword);
    const { data } = await aClient.from('consents').select('*').eq('family_id', famB.familyId);
    expect(data?.length ?? 0).toBe(0);
  }, 30000);

  it('guardian A cannot SELECT family B weekly_snapshots', async () => {
    const aClient = await asUser(famA.guardianEmail, famA.guardianPassword);
    const { data } = await aClient.from('weekly_snapshots').select('*').eq('account_id', famB.accountId);
    expect(data?.length ?? 0).toBe(0);
  }, 30000);

  it('guardian A CAN SELECT own family data', async () => {
    const aClient = await asUser(famA.guardianEmail, famA.guardianPassword);
    const { data } = await aClient.from('accounts').select('*').eq('id', famA.accountId);
    expect(data?.length ?? 0).toBe(1);
  }, 30000);
});
