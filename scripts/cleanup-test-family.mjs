#!/usr/bin/env node
/**
 * Maintenance utility: temporarily disable consents/transactions append-only trigger
 * to delete test families. Use ONLY for cleanup of obviously-test data.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envFile = readFileSync(join(__dirname, '..', '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n').filter((l) => l && !l.startsWith('#') && l.includes('=')).map((l) => {
    const i = l.indexOf('=');
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
  })
);
const m = env.SUPABASE_APP_DB_URL.match(/^postgresql:\/\/([^:]+):(.+)@([^:\/]+):(\d+)\/(.+)$/);
const [, u, p, h, port, db] = m;

const client = new pg.Client({
  user: u, password: p, host: h, port: Number(port), database: db,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

await client.query('BEGIN');
await client.query('ALTER TABLE consents DISABLE TRIGGER consents_no_delete');
await client.query('ALTER TABLE transactions DISABLE TRIGGER transactions_no_delete');
const { rowCount } = await client.query(
  `DELETE FROM families WHERE name LIKE 'Test Family %'`
);
await client.query('ALTER TABLE consents ENABLE TRIGGER consents_no_delete');
await client.query('ALTER TABLE transactions ENABLE TRIGGER transactions_no_delete');
await client.query('COMMIT');

console.log(`✅ Deleted ${rowCount} test family rows (cascade).`);
await client.end();
