import { NextResponse } from 'next/server';
import { POLICY_VERSION } from '@/lib/decision-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    ok: true,
    product: 'ThenAct',
    policyVersion: POLICY_VERSION,
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    aiGatewayAuth: process.env.VERCEL ? 'vercel-oidc' : Boolean(process.env.AI_GATEWAY_API_KEY) ? 'api-key' : 'missing-local-auth',
  });
}
