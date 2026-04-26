#!/usr/bin/env node
// Removes orphaned auth.users — those with no family membership.
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

const r = await client.query(`
  DELETE FROM auth.users u
  WHERE NOT EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)
  RETURNING email
`);
console.log(`Deleted ${r.rowCount} orphan auth users:`);
for (const row of r.rows) console.log(`  - ${row.email}`);

await client.end();
