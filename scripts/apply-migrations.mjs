#!/usr/bin/env node
/**
 * Apply Supabase migrations directly via pg connection.
 * Reads SUPABASE_APP_DB_URL from .env.local.
 * Usage: node scripts/apply-migrations.mjs
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

const envFile = readFileSync(join(repoRoot, '.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile
    .split('\n')
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const idx = line.indexOf('=');
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const dbUrl = env.SUPABASE_APP_DB_URL;
if (!dbUrl) {
  console.error('SUPABASE_APP_DB_URL not set in .env.local');
  process.exit(1);
}

// Manual parsing because special chars (#) in password break URL.parse
const dbMatch = dbUrl.match(/^postgresql:\/\/([^:]+):(.+)@([^:\/]+):(\d+)\/(.+)$/);
if (!dbMatch) {
  console.error('Cannot parse SUPABASE_APP_DB_URL');
  process.exit(1);
}
const [, dbUser, dbPass, dbHost, dbPort, dbName] = dbMatch;

const migrationsDir = join(repoRoot, 'supabase/migrations');
const upMigrations = readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql') && !f.endsWith('.down.sql'))
  .sort();

console.log(`Found ${upMigrations.length} migrations:`);
upMigrations.forEach((m) => console.log('  -', m));
console.log();

const client = new pg.Client({
  user: dbUser,
  password: dbPass,
  host: dbHost,
  port: Number(dbPort),
  database: dbName,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log('Connected to Supabase Postgres.\n');

await client.query(`
  CREATE TABLE IF NOT EXISTS _applied_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`);

const { rows: alreadyApplied } = await client.query(
  'SELECT name FROM _applied_migrations'
);
const appliedSet = new Set(alreadyApplied.map((r) => r.name));

for (const migrationFile of upMigrations) {
  if (appliedSet.has(migrationFile)) {
    console.log(`⏭  ${migrationFile} already applied`);
    continue;
  }
  const sql = readFileSync(join(migrationsDir, migrationFile), 'utf8');
  process.stdout.write(`▶  ${migrationFile} ... `);
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('INSERT INTO _applied_migrations (name) VALUES ($1)', [migrationFile]);
    await client.query('COMMIT');
    console.log('✅');
  } catch (err) {
    await client.query('ROLLBACK');
    console.log('❌');
    console.error('  Error:', err.message);
    process.exit(1);
  }
}

await client.end();
console.log('\n✅ All migrations applied successfully.');
