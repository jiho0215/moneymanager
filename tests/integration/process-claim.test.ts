import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import {
  getAdminClient,
  getPgClient,
  createTestFamily,
  cleanupAllTestData,
  type CreatedFamily,
} from './setup';

describe('process_claim — atomic + business rules', () => {
  let fam: CreatedFamily;

  beforeAll(async () => {
    await cleanupAllTestData();
    fam = await createTestFamily({ startingCapital: 10000 });
    // Force epoch to past (so week_num > 0). Use pg with trigger disable not needed (accounts has no trigger).
    const pgc = await getPgClient();
    try {
      await pgc.query(
        `UPDATE accounts SET epoch_kst = NOW() - INTERVAL '14 days' WHERE id = $1`,
        [fam.accountId]
      );
    } finally {
      await pgc.end();
    }
  }, 60000);

  afterAll(async () => {
    await cleanupAllTestData();
  }, 60000);

  it('correct answer claims atomically — adds tx, updates balance, writes snapshot', async () => {
    const admin = getAdminClient();
    const { data: weekData } = await admin.rpc('compute_week_num', { p_account_id: fam.accountId });
    const week = Number(weekData);
    expect(week).toBeGreaterThan(0);

    const beforeAcc = (await admin.from('accounts').select('experiment_balance, last_claimed_week_num').eq('id', fam.accountId).single()).data!;
    const beforeTxs = (await admin.from('transactions').select('id').eq('account_id', fam.accountId)).data!.length;
    const beforeSnaps = (await admin.from('weekly_snapshots').select('id').eq('account_id', fam.accountId)).data!.length;

    const { data: result } = await admin.rpc('process_claim', {
      p_account_id: fam.accountId,
      p_week_num: week,
      p_problem_id: 'test_p1',
      p_user_answer: '11',
      p_expected_answer: '11',
      p_problem_data: { question: '1+10=?' },
    });

    expect(result.ok).toBe(true);
    expect(result.growth_this_week).toBeGreaterThan(0);

    const afterAcc = (await admin.from('accounts').select('experiment_balance, last_claimed_week_num').eq('id', fam.accountId).single()).data!;
    const afterTxs = (await admin.from('transactions').select('id').eq('account_id', fam.accountId)).data!.length;
    const afterSnaps = (await admin.from('weekly_snapshots').select('id').eq('account_id', fam.accountId)).data!.length;

    expect(Number(afterAcc.experiment_balance)).toBeGreaterThan(Number(beforeAcc.experiment_balance));
    expect(Number(afterAcc.last_claimed_week_num)).toBe(week);
    expect(afterTxs).toBeGreaterThan(beforeTxs);
    expect(afterSnaps).toBeGreaterThanOrEqual(beforeSnaps);
  }, 30000);

  it('second claim same week → already_claimed', async () => {
    const admin = getAdminClient();
    const { data: weekData } = await admin.rpc('compute_week_num', { p_account_id: fam.accountId });
    const { data: result } = await admin.rpc('process_claim', {
      p_account_id: fam.accountId,
      p_week_num: Number(weekData),
      p_problem_id: 'test_p2',
      p_user_answer: '11',
      p_expected_answer: '11',
      p_problem_data: { q: 'x' },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('already_claimed');
  }, 30000);

  it('wrong answer logs attempt but does NOT update balance', async () => {
    const fam2 = await createTestFamily({ startingCapital: 10000 });
    const pgc = await getPgClient();
    try {
      await pgc.query(`UPDATE accounts SET epoch_kst = NOW() - INTERVAL '14 days' WHERE id = $1`, [fam2.accountId]);
    } finally {
      await pgc.end();
    }

    const admin = getAdminClient();
    const { data: weekData } = await admin.rpc('compute_week_num', { p_account_id: fam2.accountId });
    const before = (await admin.from('accounts').select('experiment_balance').eq('id', fam2.accountId).single()).data!;

    const { data: result } = await admin.rpc('process_claim', {
      p_account_id: fam2.accountId,
      p_week_num: Number(weekData),
      p_problem_id: 'test_wrong',
      p_user_answer: '999',
      p_expected_answer: '11',
      p_problem_data: { q: 'x' },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('wrong_answer');

    const after = (await admin.from('accounts').select('experiment_balance').eq('id', fam2.accountId).single()).data!;
    expect(Number(after.experiment_balance)).toBe(Number(before.experiment_balance));

    const attempts = (await admin.from('claim_attempts').select('*').eq('account_id', fam2.accountId)).data!;
    expect(attempts.length).toBe(1);
    expect(attempts[0]!.is_correct).toBe(false);
  }, 60000);

  it('5 wrong attempts → attempts_exhausted', async () => {
    const fam3 = await createTestFamily({ startingCapital: 10000 });
    const pgc = await getPgClient();
    try {
      await pgc.query(`UPDATE accounts SET epoch_kst = NOW() - INTERVAL '14 days' WHERE id = $1`, [fam3.accountId]);
    } finally {
      await pgc.end();
    }

    const admin = getAdminClient();
    const { data: weekData } = await admin.rpc('compute_week_num', { p_account_id: fam3.accountId });
    const week = Number(weekData);

    for (let i = 0; i < 5; i++) {
      await admin.rpc('process_claim', {
        p_account_id: fam3.accountId,
        p_week_num: week,
        p_problem_id: `test_brute_${i}`,
        p_user_answer: '999',
        p_expected_answer: '11',
        p_problem_data: { q: 'x' },
      });
    }
    const { data: sixth } = await admin.rpc('process_claim', {
      p_account_id: fam3.accountId,
      p_week_num: week,
      p_problem_id: 'test_brute_6',
      p_user_answer: '11',
      p_expected_answer: '11',
      p_problem_data: { q: 'x' },
    });
    expect(sixth.ok).toBe(false);
    expect(sixth.reason).toBe('attempts_exhausted');
  }, 60000);
});
