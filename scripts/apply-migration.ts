import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const migration = process.argv[2];
if (!migration) throw new Error('Pass a migration file path.');
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');

const databaseUrl = new URL(process.env.DATABASE_URL);
databaseUrl.searchParams.delete('sslmode');
const client = new pg.Client({
  connectionString: databaseUrl.toString(),
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(readFileSync(resolve(migration), 'utf8'));
  console.log(`Applied ${migration}`);
} finally {
  await client.end();
}
