import { Pool, neon } from '@neondatabase/serverless';

type TransactionClient = {
  query: (
    text: string,
    values?: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>;
};

export function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is not configured. Install Neon in the Vercel project.');
  return value;
}

export function sql() {
  return neon(requireDatabaseUrl());
}

export async function withDbTransaction<T>(
  work: (client: TransactionClient) => Promise<T>
) {
  const pool = new Pool({ connectionString: requireDatabaseUrl() });
  const client = await pool.connect();
  const transactionClient = client as unknown as TransactionClient;

  try {
    await client.query('BEGIN');
    const result = await work(transactionClient);
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
