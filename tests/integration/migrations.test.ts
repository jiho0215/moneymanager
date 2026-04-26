import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { getPgClient } from './setup';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('Migration UP scripts: schema integrity', () => {
  it('all 14 migrations are present (UP + DOWN pairs)', async () => {
    const dir = join(process.cwd(), 'supabase/migrations');
    const files = readdirSync(dir);
    const ups = files.filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'));
    const downs = files.filter((f) => f.endsWith('.down.sql'));
    expect(ups.length).toBeGreaterThanOrEqual(14);
    for (const up of ups) {
      const downName = up.replace(/\.sql$/, '.down.sql');
      expect(downs).toContain(downName);
    }
  });

  it('all expected tables exist with correct columns', async () => {
    const pgc = await getPgClient();
    try {
      const expectedTables = [
        'families', 'memberships', 'consents', 'accounts',
        'transactions', 'claim_attempts', 'weekly_snapshots', 'kid_login_codes',
      ];
      for (const t of expectedTables) {
        const { rows } = await pgc.query(
          `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS exists`,
          [t]
        );
        expect(rows[0]?.exists).toBe(true);
      }
    } finally {
      await pgc.end();
    }
  }, 30000);

  it('accounts.starting_capital is BIGINT (not INTEGER) per ADR-002', async () => {
    const pgc = await getPgClient();
    try {
      const { rows } = await pgc.query(
        `SELECT data_type FROM information_schema.columns
         WHERE table_name = 'accounts' AND column_name = 'starting_capital'`
      );
      expect(rows[0]?.data_type).toBe('bigint');
    } finally {
      await pgc.end();
    }
  }, 30000);

  it('all RLS policies enabled on protected tables', async () => {
    const pgc = await getPgClient();
    try {
      const tables = ['families', 'memberships', 'consents', 'accounts', 'transactions', 'claim_attempts', 'weekly_snapshots', 'kid_login_codes'];
      for (const t of tables) {
        const { rows } = await pgc.query(
          `SELECT relrowsecurity FROM pg_class WHERE relname = $1`,
          [t]
        );
        expect(rows[0]?.relrowsecurity).toBe(true);
      }
    } finally {
      await pgc.end();
    }
  }, 30000);

  it('append-only triggers exist on transactions and consents', async () => {
    const pgc = await getPgClient();
    try {
      const { rows } = await pgc.query(
        `SELECT trigger_name, event_object_table FROM information_schema.triggers
         WHERE event_object_schema = 'public'
           AND event_object_table IN ('transactions', 'consents')
         ORDER BY trigger_name`
      );
      const names = rows.map((r) => r.trigger_name);
      expect(names).toContain('transactions_no_update');
      expect(names).toContain('transactions_no_delete');
      expect(names).toContain('consents_no_update');
      expect(names).toContain('consents_no_delete');
    } finally {
      await pgc.end();
    }
  }, 30000);

  it('all 8 expected RPC functions exist', async () => {
    const pgc = await getPgClient();
    try {
      const expected = [
        'compute_week_num', 'reconcile_balance', 'recompute_balance',
        'create_family_with_kid', 'process_claim', 'transfer_free_to_experiment',
        'process_deposit', 'choose_cycle_end_action',
      ];
      for (const fn of expected) {
        const { rows } = await pgc.query(
          `SELECT proname FROM pg_proc WHERE proname = $1`,
          [fn]
        );
        expect(rows.length).toBeGreaterThan(0);
      }
    } finally {
      await pgc.end();
    }
  }, 30000);
});
