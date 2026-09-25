import { NextResponse } from 'next/server';
import { getAudit } from '@/lib/audit';
import { evaluate } from '@/lib/decision-engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { auditId?: unknown };
    if (typeof body.auditId !== 'string') {
      return NextResponse.json({ error: 'auditId is required' }, { status: 400 });
    }

    const record = await getAudit(body.auditId);
    if (!record) return NextResponse.json({ error: 'audit record not found' }, { status: 404 });

    const current = evaluate(record.domain, record.action, record.context);
    return NextResponse.json({
      originalDecision: record.decision,
      currentDecision: current.decision,
      drift: record.decision !== current.decision || record.policyVersion !== current.policyVersion,
      originalPolicyVersion: record.policyVersion,
      currentPolicyVersion: current.policyVersion,
      current,
    });
  } catch (error) {
    console.error('replay_error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Replay failed.' },
      { status: 500 }
    );
  }
}
