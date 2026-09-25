import { Pool, neon } from '@neondatabase/serverless';

export function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is not configured. Install Neon in the Vercel project.');
  return value;
}

export function sql() {
  return neon(requireDatabaseUrl());
}

export async function withDbTransaction<T>(work: (client: Awaited<ReturnType<Pool['connect']>>) => Promise<T>) {
  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
