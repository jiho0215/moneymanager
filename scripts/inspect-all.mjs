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

console.log('\n=== ALL TABLES STATE ===\n');
for (const t of ['families', 'memberships', 'accounts', 'transactions', 'weekly_snapshots', 'consents', 'claim_attempts']) {
  const r = await client.query(`SELECT COUNT(*) AS c FROM ${t}`);
  console.log(`${t.padEnd(20)} ${r.rows[0].c} rows`);
}

console.log('\n=== AUTH USERS ===\n');
const u = await client.query(`SELECT email, raw_user_meta_data->>'role' AS role FROM auth.users ORDER BY created_at`);
for (const row of u.rows) {
  console.log(`${(row.role ?? 'no-role').padEnd(10)} ${row.email}`);
}

await client.end();
