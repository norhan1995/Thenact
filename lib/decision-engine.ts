import type {
  Authority,
  Context,
  CostOfError,
  Evaluation,
  Reversibility,
  TraceStep,
} from './types';

export const POLICY_VERSION = 'v2026.09.2';
export const DOMAINS = ['ticket_triage', 'refund_approval', 'code_deploy'] as const;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function numberValue(context: Context, key: string, fallback: number) {
  return typeof context[key] === 'number' ? (context[key] as number) : fallback;
}

function booleanValue(context: Context, key: string, fallback: boolean) {
  return typeof context[key] === 'boolean' ? (context[key] as boolean) : fallback;
}

function stringValue(context: Context, key: string, fallback: string) {
  return typeof context[key] === 'string' ? (context[key] as string) : fallback;
}

function hasValue(context: Context, key: string) {
  const value = context[key];
  return value !== undefined && value !== null && value !== '';
}

function trace(
  code: string,
  label: string,
  status: TraceStep['status'],
  detail: string
): TraceStep {
  return { code, label, status, detail };
}

export function evaluate(domain: string, action: string, context: Context): Evaluation {
  const evidenceUsed: string[] = [];
  const missingInformation: string[] = [];
  const reasonCodes: string[] = [];
  const policyTrace: TraceStep[] = [];
  const modelConfidence = numberValue(context, 'modelConfidence', 0.72);
  const evidenceFresh = booleanValue(context, 'evidenceFresh', false);
  let risk = 10;
  let reversibility: Reversibility = 'high';
  let authority: Authority = 'not_required';
  let hardRefusal = false;
  let hardRefusalDetail = '';

  if (!DOMAINS.includes(domain as (typeof DOMAINS)[number])) {
    hardRefusal = true;
    hardRefusalDetail = 'Domain is not registered in the active policy.';
    reasonCodes.push('POLICY.UNKNOWN_DOMAIN');
  }

  if (domain === 'ticket_triage') {
    if (!hasValue(context, 'category')) missingInformation.push('ticket category');
    else evidenceUsed.push(`classifier category: ${stringValue(context, 'category', 'unknown')}`);

    if (!hasValue(context, 'containsSensitiveData')) {
      missingInformation.push('sensitive-data assessment');
    } else {
      evidenceUsed.push('sensitive-data detector');
    }

    if (hasValue(context, 'customerTier')) evidenceUsed.push('customer tier');

    risk = 14;
    if (booleanValue(context, 'containsSensitiveData', false)) risk += 36;
    if (stringValue(context, 'customerTier', 'standard') === 'vip') risk += 10;
    reversibility = 'high';

    if (action !== 'route_ticket') {
      hardRefusal = true;
      hardRefusalDetail = 'Action is not allowed for ticket triage.';
      reasonCodes.push('POLICY.ACTION_NOT_ALLOWED');
    }
  }

  if (domain === 'refund_approval') {
    const amount = numberValue(context, 'amount', 0);
    const fraudScore = numberValue(context, 'fraudScore', 0);
    const receiptVerified = booleanValue(context, 'receiptVerified', false);
    const approvalVerified = booleanValue(context, 'approvalVerified', false);

    if (!hasValue(context, 'amount')) missingInformation.push('refund amount');
    else evidenceUsed.push(`order amount: ${amount.toFixed(2)}`);
    if (!hasValue(context, 'orderAgeDays')) missingInformation.push('order age');
    else evidenceUsed.push('order age');
    if (!hasValue(context, 'receiptVerified')) missingInformation.push('receipt verification status');
    else if (!receiptVerified) missingInformation.push('verified receipt');
    else evidenceUsed.push('receipt verification');
    if (!hasValue(context, 'fraudScore')) missingInformation.push('fraud score');
    else evidenceUsed.push('fraud risk feed');

    risk = 18 + Math.min(42, amount * 0.06) + fraudScore * 35;
    if (!receiptVerified) risk += 15;
    if (amount > 200 && !approvalVerified) risk += 18;

    reversibility =
      amount > 500 && booleanValue(context, 'refundCaptured', false) ? 'medium' : 'high';
    authority = amount > 200 ? (approvalVerified ? 'verified' : 'unverified') : 'not_required';

    if (action !== 'approve_refund') {
      hardRefusal = true;
      hardRefusalDetail = 'Action is not allowed for refund approval.';
      reasonCodes.push('POLICY.ACTION_NOT_ALLOWED');
    }
    if (fraudScore >= 0.85) {
      hardRefusal = true;
      hardRefusalDetail = 'Fraud score crossed the hard-block threshold.';
      reasonCodes.push('REFUND.FRAUD_HARD_BLOCK');
    }
    if (booleanValue(context, 'forgedApproval', false)) {
      hardRefusal = true;
      hardRefusalDetail = 'Claimed approval failed authority verification.';
      reasonCodes.push('AUTHORITY.FORGED_APPROVAL');
    }
  }

  if (domain === 'code_deploy') {
    const environment = stringValue(context, 'environment', '');
    const testsPassed = booleanValue(context, 'testsPassed', false);
    const rollbackReady = booleanValue(context, 'rollbackReady', false);
    const migration = booleanValue(context, 'databaseMigration', false);

    if (!environment) missingInformation.push('target environment');
    else evidenceUsed.push(`environment: ${environment}`);
    if (!hasValue(context, 'testsPassed')) missingInformation.push('CI test status');
    else evidenceUsed.push('CI test status');
    if (!hasValue(context, 'rollbackReady')) missingInformation.push('rollback readiness');
    else evidenceUsed.push('rollback readiness');
    if (migration) evidenceUsed.push('database migration flag');

    risk = environment === 'production' ? 45 : 20;
    if (migration) risk += 25;
    if (!rollbackReady) risk += 25;
    if (!testsPassed) risk += 30;
    reversibility =
      environment === 'production' ? (rollbackReady && !migration ? 'medium' : 'low') : 'high';
    authority = environment === 'production' ? 'verified' : 'not_required';

    if (action !== 'deploy_release') {
      hardRefusal = true;
      hardRefusalDetail = 'Action is not allowed for code deploy.';
      reasonCodes.push('POLICY.ACTION_NOT_ALLOWED');
    }
    if (booleanValue(context, 'bypassRequested', false)) {
      hardRefusal = true;
      hardRefusalDetail = 'The proposal explicitly requested a policy bypass.';
      reasonCodes.push('DEPLOY.BYPASS_REQUESTED');
    }
    if (environment === 'production' && hasValue(context, 'testsPassed') && !testsPassed) {
      hardRefusal = true;
      hardRefusalDetail = 'Production deployment cannot proceed with failed tests.';
      reasonCodes.push('DEPLOY.PROD_TEST_GATE_FAILED');
    }
  }

  risk = clamp(risk, 0, 100);
  const confidence = clamp(
    modelConfidence * 100 - missingInformation.length * 12 - (evidenceFresh ? 0 : 20),
    5,
    99
  );
  const evidenceQuality = clamp(
    100 - missingInformation.length * 18 - (evidenceFresh ? 0 : 35) - (authority === 'unverified' ? 20 : 0),
    0,
    100
  );
  const costOfError: CostOfError =
    risk >= 70 || reversibility === 'low' ? 'high' : risk >= 40 ? 'medium' : 'low';

  policyTrace.push(
    trace(
      'P1',
      'Hard policy',
      hardRefusal ? 'fail' : 'pass',
      hardRefusal ? hardRefusalDetail : 'No non-negotiable policy boundary was crossed.'
    )
  );
  policyTrace.push(
    trace(
      'P2',
      'Evidence freshness',
      evidenceFresh ? 'pass' : 'warn',
      evidenceFresh ? 'Required evidence is current.' : 'Evidence freshness is stale or unverified.'
    )
  );
  policyTrace.push(
    trace(
      'P3',
      'Missing information',
      missingInformation.length ? 'warn' : 'pass',
      missingInformation.length ? missingInformation.join(', ') : 'No required context is missing.'
    )
  );
  policyTrace.push(
    trace(
      'P4',
      'Authority',
      authority === 'unverified' ? 'warn' : 'pass',
      authority === 'not_required'
        ? 'No elevated authority required.'
        : authority === 'verified'
          ? 'Required authority is verified.'
          : 'Elevated authority is required but not verified.'
    )
  );
  policyTrace.push(
    trace(
      'P5',
      'Risk + reversibility',
      risk >= 70 || reversibility === 'low' ? 'warn' : 'pass',
      `risk ${risk}/100 · reversibility ${reversibility}`
    )
  );
  policyTrace.push(
    trace(
      'P6',
      'Confidence',
      confidence < 72 ? 'warn' : 'pass',
      `effective confidence ${confidence}%`
    )
  );

  let decision: Evaluation['decision'];
  if (hardRefusal) {
    decision = 'refuse';
    reasonCodes.unshift('GATE.HARD_POLICY_BLOCK');
  } else if (!evidenceFresh) {
    decision = 'defer';
    reasonCodes.push('EVIDENCE.STALE_OR_UNVERIFIED');
  } else if (missingInformation.length > 0) {
    if (risk >= 55) {
      decision = 'escalate';
      reasonCodes.push('GATE.MISSING_CRITICAL_HIGH_RISK');
    } else {
      decision = 'ask';
      reasonCodes.push('GATE.MISSING_ANSWERABLE_CONTEXT');
    }
  } else if (authority === 'unverified') {
    decision = 'escalate';
    reasonCodes.push('AUTHORITY.HUMAN_APPROVAL_REQUIRED');
  } else if (risk >= 70 || reversibility === 'low') {
    decision = 'escalate';
    reasonCodes.push(risk >= 70 ? 'RISK.ABOVE_AUTONOMY_THRESHOLD' : 'REVERSIBILITY.LOW');
  } else if (confidence < 72) {
    decision = 'ask';
    reasonCodes.push('CONFIDENCE.BELOW_EXECUTE_THRESHOLD');
  } else {
    decision = 'execute';
    reasonCodes.push('GATE.ALL_CHECKS_PASSED');
  }

  const outcomes: Record<Evaluation['decision'], string> = {
    execute: 'Action is permitted to proceed automatically.',
    ask: 'Pause and ask for the smallest missing piece of context.',
    defer: 'Do not act until stale or unverified evidence is refreshed.',
    escalate: 'Route to an authorized human or higher-trust workflow.',
    refuse: 'Block the action and preserve the refusal in the audit ledger.',
  };

  return {
    decision,
    confidence,
    riskScore: risk,
    evidenceQuality,
    costOfError,
    evidenceUsed,
    missingInformation,
    reversibility,
    authority,
    reasonCodes,
    outcome: outcomes[decision],
    policyVersion: POLICY_VERSION,
    policyTrace,
  };
}
