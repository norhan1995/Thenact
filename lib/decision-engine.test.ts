import { describe, expect, it } from 'vitest';
import { evaluate } from './decision-engine';

function ticket(overrides: Record<string, unknown> = {}) {
  return {
    modelConfidence: 0.94,
    category: 'password_reset',
    containsSensitiveData: false,
    customerTier: 'standard',
    evidenceFresh: true,
    ...overrides,
  };
}

describe('ThenAct decision engine', () => {
  it('EXECUTE: permits a low-risk, complete ticket route', () => {
    const result = evaluate('ticket_triage', 'route_ticket', ticket());
    expect(result.decision).toBe('execute');
    expect(result.reasonCodes).toContain('GATE.ALL_CHECKS_PASSED');
  });

  it('ASK: asks for missing low-risk context', () => {
    const result = evaluate('ticket_triage', 'route_ticket', ticket({ category: '' }));
    expect(result.decision).toBe('ask');
    expect(result.missingInformation).toContain('ticket category');
  });

  it('DEFER: stale evidence beats high confidence', () => {
    const result = evaluate('refund_approval', 'approve_refund', {
      modelConfidence: 0.99,
      amount: 95,
      orderAgeDays: 2,
      receiptVerified: true,
      fraudScore: 0.02,
      evidenceFresh: false,
    });
    expect(result.decision).toBe('defer');
    expect(result.reasonCodes).toContain('EVIDENCE.STALE_OR_UNVERIFIED');
  });

  it('ESCALATE: a risky production deploy with weak rollback is not autonomous', () => {
    const result = evaluate('code_deploy', 'deploy_release', {
      modelConfidence: 0.97,
      environment: 'production',
      testsPassed: true,
      rollbackReady: false,
      databaseMigration: true,
      bypassRequested: false,
      evidenceFresh: true,
    });
    expect(result.decision).toBe('escalate');
    expect(result.riskScore).toBeGreaterThanOrEqual(70);
  });

  it('REFUSE: forged authority cannot be rescued by 99% confidence', () => {
    const result = evaluate('refund_approval', 'approve_refund', {
      modelConfidence: 0.99,
      amount: 1200,
      receiptVerified: true,
      orderAgeDays: 4,
      fraudScore: 0.07,
      approvalVerified: false,
      forgedApproval: true,
      evidenceFresh: true,
      refundCaptured: true,
    });
    expect(result.decision).toBe('refuse');
    expect(result.reasonCodes).toContain('GATE.HARD_POLICY_BLOCK');
    expect(result.reasonCodes).toContain('AUTHORITY.FORGED_APPROVAL');
  });

  it('REFUSE: explicit policy bypass is a hard stop', () => {
    const result = evaluate('code_deploy', 'deploy_release', {
      modelConfidence: 0.99,
      environment: 'production',
      testsPassed: true,
      rollbackReady: true,
      databaseMigration: false,
      bypassRequested: true,
      evidenceFresh: true,
    });
    expect(result.decision).toBe('refuse');
    expect(result.reasonCodes).toContain('DEPLOY.BYPASS_REQUESTED');
  });

  it('fails closed when evidence freshness is missing', () => {
    const result = evaluate('ticket_triage', 'route_ticket', {
      modelConfidence: 0.99,
      category: 'password_reset',
      containsSensitiveData: false,
      customerTier: 'standard',
    });
    expect(result.decision).toBe('defer');
  });

  it('does not silently assume a sensitive-data assessment', () => {
    const result = evaluate('ticket_triage', 'route_ticket', {
      modelConfidence: 0.99,
      category: 'password_reset',
      customerTier: 'standard',
      evidenceFresh: true,
    });
    expect(result.decision).toBe('ask');
    expect(result.missingInformation).toContain('sensitive-data assessment');
  });
});
