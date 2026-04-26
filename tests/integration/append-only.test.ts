import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getPgClient, createTestFamily, cleanupAllTestData, type CreatedFamily } from './setup';

describe('Append-only triggers (ADR-005)', () => {
  let fam: CreatedFamily;

  beforeAll(async () => {
    await cleanupAllTestData();
    fam = await createTestFamily();
  }, 60000);

  afterAll(async () => {
    await cleanupAllTestData();
  }, 60000);

  it('UPDATE on transactions raises trigger exception', async () => {
    const pgc = await getPgClient();
    try {
      await expect(
        pgc.query(`UPDATE transactions SET amount = 999 WHERE account_id = '${fam.accountId}' AND zone = 'free'`)
      ).rejects.toThrow(/append-only/);
    } finally {
      await pgc.end();
    }
  }, 30000);

  it('DELETE on transactions raises trigger exception', async () => {
    const pgc = await getPgClient();
    try {
      await expect(
        pgc.query(`DELETE FROM transactions WHERE account_id = '${fam.accountId}'`)
      ).rejects.toThrow(/append-only/);
    } finally {
      await pgc.end();
    }
  }, 30000);

  it('UPDATE on consents raises trigger exception (PIPA legal)', async () => {
    const pgc = await getPgClient();
    try {
      await expect(
        pgc.query(`UPDATE consents SET consent_text = 'tampered' WHERE family_id = '${fam.familyId}'`)
      ).rejects.toThrow(/append-only/);
    } finally {
      await pgc.end();
    }
  }, 30000);

  it('DELETE on consents raises trigger exception', async () => {
    const pgc = await getPgClient();
    try {
      await expect(
        pgc.query(`DELETE FROM consents WHERE family_id = '${fam.familyId}'`)
      ).rejects.toThrow(/append-only/);
    } finally {
      await pgc.end();
    }
  }, 30000);

  it('INSERT on transactions succeeds (the only allowed write)', async () => {
    const pgc = await getPgClient();
    try {
      const { rowCount } = await pgc.query(
        `INSERT INTO transactions (account_id, transaction_type, zone, amount) VALUES ($1, 'manual_adjustment', 'free', 1)`,
        [fam.accountId]
      );
      expect(rowCount).toBe(1);
    } finally {
      await pgc.end();
    }
  }, 30000);
});
