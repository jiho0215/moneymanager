#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const envFile = readFileSync(join(repoRoot, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n').filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const m = env.SUPABASE_APP_DB_URL.match(/^postgresql:\/\/([^:]+):(.+)@([^:\/]+):(\d+)\/(.+)$/);
const [, user, pass, host, port, dbName] = m;
const client = new pg.Client({ user, password: pass, host, port: Number(port), database: dbName, ssl: { rejectUnauthorized: false } });
await client.connect();

console.log('\n=== ALL KIDS WITH ACCOUNT STATE ===\n');
const kids = await client.query(`
  SELECT m.display_name AS kid, m.id AS membership_id, a.id AS account_id,
         a.starting_capital, a.free_balance, a.experiment_balance, a.bonus_balance,
         a.cycle_number, a.cycle_status, a.last_claimed_week_num, a.week_num_started,
         (a.epoch_kst AT TIME ZONE 'Asia/Seoul') AS epoch_kst,
         a.weekly_growth_rate_bp
  FROM memberships m JOIN accounts a ON a.membership_id = m.id
  WHERE m.role = 'kid' ORDER BY a.created_at;
`);
for (const k of kids.rows) {
  console.log(`🌱 ${k.kid} (account ${k.account_id.slice(0, 8)})`);
  console.log(`   start=${k.starting_capital} | free=${k.free_balance} exp=${k.experiment_balance} bonus=${k.bonus_balance}`);
  console.log(`   total=${BigInt(k.free_balance) + BigInt(k.experiment_balance) + BigInt(k.bonus_balance)}`);
  console.log(`   cycle=${k.cycle_number} ${k.cycle_status} | last_claimed=${k.last_claimed_week_num} | epoch=${k.epoch_kst}`);
  console.log(`   rate=${k.weekly_growth_rate_bp}bp (${k.weekly_growth_rate_bp / 100}%)`);

  console.log(`\n   --- TRANSACTIONS (chronological) ---`);
  const txs = await client.query(
    `SELECT transaction_type, zone, amount, week_num, created_at
       FROM transactions WHERE account_id = $1 ORDER BY created_at`,
    [k.account_id]
  );
  for (const t of txs.rows) {
    console.log(`   [${t.created_at.toISOString().slice(0, 19)}] ${t.transaction_type.padEnd(20)} zone=${t.zone.padEnd(11)} amount=${String(t.amount).padStart(8)} week=${t.week_num ?? '-'}`);
  }

  console.log(`\n   --- WEEKLY SNAPSHOTS ---`);
  const sn = await client.query(
    `SELECT week_num, free_balance, experiment_balance, bonus_balance, was_claimed_this_week
       FROM weekly_snapshots WHERE account_id = $1 ORDER BY cycle_number, week_num`,
    [k.account_id]
  );
  for (const s of sn.rows) {
    console.log(`   week ${s.week_num}: free=${s.free_balance} exp=${s.experiment_balance} bonus=${s.bonus_balance} claimed=${s.was_claimed_this_week}`);
  }

  console.log(`\n   --- LEDGER vs CACHE RECONCILE ---`);
  const rec = await client.query(`SELECT reconcile_balance($1) AS r`, [k.account_id]);
  console.log(`   ${JSON.stringify(rec.rows[0].r)}`);
  console.log('');
}

await client.end();
