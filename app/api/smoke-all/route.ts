import { NextResponse } from 'next/server';
import { evaluate } from '@/lib/decision-engine';
import { persistDecision } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cases = [
  {
    name: 'execute',
    domain: 'ticket_triage',
    action: 'route_ticket',
    expected: 'execute',
    context: {
      modelConfidence: 0.94,
      category: 'password_reset',
      containsSensitiveData: false,
      customerTier: 'standard',
      evidenceFresh: true,
    },
  },
  {
    name: 'ask',
    domain: 'ticket_triage',
    action: 'route_ticket',
    expected: 'ask',
    context: {
      modelConfidence: 0.91,
      category: '',
      containsSensitiveData: false,
      customerTier: 'standard',
      evidenceFresh: true,
    },
  },
  {
    name: 'defer',
    domain: 'refund_approval',
    action: 'approve_refund',
    expected: 'defer',
    context: {
      modelConfidence: 0.98,
      amount: 95,
      orderAgeDays: 2,
      receiptVerified: true,
      fraudScore: 0.02,
      evidenceFresh: false,
    },
  },
  {
    name: 'escalate',
    domain: 'code_deploy',
    action: 'deploy_release',
    expected: 'escalate',
    context: {
      modelConfidence: 0.97,
      environment: 'production',
      testsPassed: true,
      rollbackReady: false,
      databaseMigration: true,
      bypassRequested: false,
      evidenceFresh: true,
    },
  },
  {
    name: 'refuse',
    domain: 'refund_approval',
    action: 'approve_refund',
    expected: 'refuse',
    context: {
      modelConfidence: 0.99,
      amount: 1200,
      receiptVerified: true,
      orderAgeDays: 4,
      fraudScore: 0.07,
      approvalVerified: false,
      forgedApproval: true,
      evidenceFresh: true,
      refundCaptured: true,
    },
  },
] as const;

export async function GET() {
  const results = [];

  for (const item of cases) {
    const evaluation = evaluate(item.domain, item.action, item.context);
    const record = await persistDecision({
      domain: item.domain,
      action: item.action,
      context: item.context,
      evaluation,
      enforce: true,
    });

    results.push({
      name: item.name,
      expected: item.expected,
      actual: record.decision,
      executed: record.enforcement.executed,
      receiptId: record.enforcement.receiptId ?? null,
      auditId: record.id,
      passed:
        record.decision === item.expected &&
        (item.expected === 'execute'
          ? record.enforcement.executed === true
          : record.enforcement.executed === false),
    });
  }

  return NextResponse.json({
    ok: results.every(item => item.passed),
    results,
  });
}
