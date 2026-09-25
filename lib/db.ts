import { Pool, neon } from '@neondatabase/serverless';

type TransactionClient = {
  query: (
    text: string,
    values?: unknown[]
  ) => Promise<{ rows: Record<string, unknown>[] }>;
};

let schemaPromise: Promise<void> | null = null;

export function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL is not configured. Install Neon in the Vercel project.');
  return value;
}

export function sql() {
  return neon(requireDatabaseUrl());
}

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const query = sql();

      await query.query(`
        CREATE TABLE IF NOT EXISTS thenact_audit (
          id TEXT PRIMARY KEY,
          domain TEXT NOT NULL,
          action TEXT NOT NULL,
          context JSONB NOT NULL,
          decision TEXT NOT NULL CHECK (
            decision IN ('execute', 'ask', 'defer', 'escalate', 'refuse')
          ),
          confidence INTEGER NOT NULL,
          risk_score INTEGER NOT NULL,
          evidence_quality INTEGER NOT NULL,
          cost_of_error TEXT NOT NULL,
          evidence_used JSONB NOT NULL,
          missing_information JSONB NOT NULL,
          reversibility TEXT NOT NULL,
          authority TEXT NOT NULL,
          reason_codes JSONB NOT NULL,
          outcome TEXT NOT NULL,
          policy_version TEXT NOT NULL,
          policy_trace JSONB NOT NULL,
          enforcement JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL,
          previous_hash TEXT NOT NULL,
          record_hash TEXT NOT NULL UNIQUE
        )
      `);

      await query.query(`
        CREATE INDEX IF NOT EXISTS thenact_audit_created_at_idx
          ON thenact_audit (created_at DESC, id DESC)
      `);

      await query.query(`
        CREATE TABLE IF NOT EXISTS thenact_execution_receipts (
          id TEXT PRIMARY KEY,
          domain TEXT NOT NULL,
          action TEXT NOT NULL,
          policy_version TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status = 'executed'),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    })().catch(error => {
      schemaPromise = null;
      throw error;
    });
  }

  await schemaPromise;
}

export async function withDbTransaction<T>(
  work: (client: TransactionClient) => Promise<T>
) {
  await ensureSchema();

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
