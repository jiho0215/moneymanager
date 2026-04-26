import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getAdminClient, createTestFamily, cleanupAllTestData, type CreatedFamily } from './setup';

describe('Family creation + PIPA + multi-tenancy', () => {
  let fam: CreatedFamily;

  beforeAll(async () => {
    await cleanupAllTestData();
    fam = await createTestFamily({ startingCapital: 50000 });
  }, 60000);

  afterAll(async () => {
    await cleanupAllTestData();
  }, 60000);

  it('PIPA consent record stored with text + version + timestamp', async () => {
    const admin = getAdminClient();
    const { data: consents } = await admin.from('consents').select('*').eq('family_id', fam.familyId);
    expect(consents?.length).toBe(1);
    expect(consents![0]!.consent_version).toBe('v1');
    expect(consents![0]!.consent_text).toContain('TEST consent');
    expect(consents![0]!.accepted_at).toBeTruthy();
    expect(consents![0]!.accepted_by_user_id).toBe(fam.guardianUserId);
  }, 30000);

  it('account split: 80% free, 20% experiment for 50000 starting', async () => {
    const admin = getAdminClient();
    const { data: account } = await admin.from('accounts').select('*').eq('id', fam.accountId).single();
    expect(Number(account?.starting_capital)).toBe(50000);
    expect(Number(account?.free_balance)).toBe(40000);
    expect(Number(account?.experiment_balance)).toBe(10000);
    expect(Number(account?.bonus_balance)).toBe(0);
    expect(account?.cycle_status).toBe('active');
    expect(Number(account?.cycle_number)).toBe(1);
  }, 30000);

  it('initial_deposit transactions: 2 rows (free + experiment)', async () => {
    const admin = getAdminClient();
    const { data: txs } = await admin
      .from('transactions')
      .select('*')
      .eq('account_id', fam.accountId)
      .eq('transaction_type', 'initial_deposit');
    expect(txs?.length).toBe(2);
    const free = txs!.find((t) => t.zone === 'free');
    const exp = txs!.find((t) => t.zone === 'experiment');
    expect(Number(free?.amount)).toBe(40000);
    expect(Number(exp?.amount)).toBe(10000);
  }, 30000);

  it('week_num starts at 0', async () => {
    const admin = getAdminClient();
    const { data } = await admin.rpc('compute_week_num', { p_account_id: fam.accountId });
    expect(Number(data)).toBeGreaterThanOrEqual(0);
    expect(Number(data)).toBeLessThan(2);
  }, 30000);

  it('reconcile_balance shows no drift on fresh account', async () => {
    const admin = getAdminClient();
    const { data } = await admin.rpc('reconcile_balance', { p_account_id: fam.accountId });
    expect(data.drift).toBe(false);
  }, 30000);

  it('weekly_snapshot row 0 matches initial state', async () => {
    const admin = getAdminClient();
    const { data: snaps } = await admin
      .from('weekly_snapshots')
      .select('*')
      .eq('account_id', fam.accountId)
      .eq('week_num', 0);
    expect(snaps?.length).toBe(1);
    expect(Number(snaps![0]!.experiment_balance)).toBe(10000);
    expect(Number(snaps![0]!.total_balance)).toBe(50000);
  }, 30000);

  it('multi-tenancy: 2 families have isolated data', async () => {
    const fam2 = await createTestFamily({ startingCapital: 5000 });
    expect(fam2.familyId).not.toBe(fam.familyId);
    expect(fam2.accountId).not.toBe(fam.accountId);

    const admin = getAdminClient();
    const { data } = await admin.from('accounts').select('id').in('id', [fam.accountId, fam2.accountId]);
    expect(data?.length).toBe(2);
  }, 60000);
});
