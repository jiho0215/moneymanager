import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getAdminClient, createTestFamily, cleanupAllTestData, type CreatedFamily } from './setup';

describe('process_deposit + choose_cycle_end_action', () => {
  let fam: CreatedFamily;

  beforeAll(async () => {
    await cleanupAllTestData();
    fam = await createTestFamily({ startingCapital: 10000 });
  }, 60000);

  afterAll(async () => {
    await cleanupAllTestData();
  }, 60000);

  it('deposit to experiment zone applies bonus match (20%)', async () => {
    const admin = getAdminClient();
    const before = (await admin.from('accounts').select('*').eq('id', fam.accountId).single()).data!;

    const { data } = await admin.rpc('process_deposit', {
      p_account_id: fam.accountId,
      p_amount: 5000,
      p_zone: 'experiment',
    });
    expect(data.ok).toBe(true);
    expect(Number(data.bonus_amount)).toBe(1000);

    const after = (await admin.from('accounts').select('*').eq('id', fam.accountId).single()).data!;
    expect(Number(after.experiment_balance)).toBe(Number(before.experiment_balance) + 5000);
    expect(Number(after.bonus_balance)).toBe(Number(before.bonus_balance) + 1000);
  }, 30000);

  it('deposit to free zone applies no bonus', async () => {
    const admin = getAdminClient();
    const before = (await admin.from('accounts').select('*').eq('id', fam.accountId).single()).data!;
    const { data } = await admin.rpc('process_deposit', {
      p_account_id: fam.accountId,
      p_amount: 3000,
      p_zone: 'free',
    });
    expect(data.ok).toBe(true);
    expect(Number(data.bonus_amount)).toBe(0);
    const after = (await admin.from('accounts').select('*').eq('id', fam.accountId).single()).data!;
    expect(Number(after.free_balance)).toBe(Number(before.free_balance) + 3000);
    expect(Number(after.bonus_balance)).toBe(Number(before.bonus_balance));
  }, 30000);

  it('deposit with zero amount → invalid_amount', async () => {
    const admin = getAdminClient();
    const { data } = await admin.rpc('process_deposit', {
      p_account_id: fam.accountId,
      p_amount: 0,
      p_zone: 'free',
    });
    expect(data.ok).toBe(false);
    expect(data.reason).toBe('invalid_amount');
  }, 30000);

  it('cycle: graduate locks the account', async () => {
    const fam2 = await createTestFamily();
    const admin = getAdminClient();
    const { data: r } = await admin.rpc('choose_cycle_end_action', {
      p_account_id: fam2.accountId,
      p_action: 'graduate',
    });
    expect(r.ok).toBe(true);
    expect(r.cycle_status).toBe('graduated');

    // Subsequent deposit fails because cycle ended
    const { data: dep } = await admin.rpc('process_deposit', {
      p_account_id: fam2.accountId,
      p_amount: 1000,
      p_zone: 'free',
    });
    expect(dep.ok).toBe(false);
    expect(dep.reason).toBe('cycle_ended');
  }, 60000);

  it('cycle: reset increments cycle_number, fresh balance, transactions preserved', async () => {
    const fam3 = await createTestFamily({ startingCapital: 10000 });
    const admin = getAdminClient();

    const beforeTxs = (await admin.from('transactions').select('id').eq('account_id', fam3.accountId)).data!.length;

    const { data } = await admin.rpc('choose_cycle_end_action', {
      p_account_id: fam3.accountId,
      p_action: 'reset',
      p_new_starting_capital: 20000,
    });
    expect(data.ok).toBe(true);
    expect(Number(data.cycle_number)).toBe(2);

    const after = (await admin.from('accounts').select('*').eq('id', fam3.accountId).single()).data!;
    expect(Number(after.cycle_number)).toBe(2);
    expect(Number(after.starting_capital)).toBe(20000);
    expect(Number(after.free_balance)).toBe(16000);
    expect(Number(after.experiment_balance)).toBe(4000);
    expect(after.last_claimed_week_num).toBeNull();

    const afterTxs = (await admin.from('transactions').select('id').eq('account_id', fam3.accountId)).data!.length;
    expect(afterTxs).toBeGreaterThan(beforeTxs);
  }, 60000);
});
