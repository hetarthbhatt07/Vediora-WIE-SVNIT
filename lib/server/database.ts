import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

declare global {
  // Reuse the pool during local hot reloads.
  var vedioraDatabasePool: Pool | undefined;
}

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not configured.');

  // pg-connection-string lets an sslmode query parameter replace the explicit
  // TLS object. Remove it so the Supabase pooler's certificate chain can use
  // the configuration below consistently in local and hosted runtimes.
  const databaseUrl = new URL(connectionString);
  databaseUrl.searchParams.delete('sslmode');

  if (!globalThis.vedioraDatabasePool) {
    globalThis.vedioraDatabasePool = new Pool({
      connectionString: databaseUrl.toString(),
      max: 4,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 10_000,
      query_timeout: 15_000,
      ssl: { rejectUnauthorized: false },
    });
  }

  return globalThis.vedioraDatabasePool;
}

export async function query<Row extends QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<Row>(text, values);
}

export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}
