import { NextResponse } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { POLICY_VERSION } from '@/lib/decision-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const databaseConfigured = Boolean(process.env.DATABASE_URL);
  let databaseReady = false;
  let databaseError: string | null = null;

  if (databaseConfigured) {
    try {
      await ensureSchema();
      databaseReady = true;
    } catch (error) {
      databaseError = error instanceof Error ? error.message : 'Database initialization failed.';
    }
  }

  const aiConfigured = Boolean(process.env.OPENROUTER_API_KEY);
  const ok = databaseConfigured && databaseReady;

  return NextResponse.json(
    {
      ok,
      product: 'ThenAct',
      policyVersion: POLICY_VERSION,
      databaseConfigured,
      databaseReady,
      databaseError,
      aiProvider: 'openrouter-free',
      aiConfigured,
    },
    { status: ok ? 200 : 503 }
  );
}
