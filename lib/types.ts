export type Decision = 'execute' | 'ask' | 'defer' | 'escalate' | 'refuse';
export type Reversibility = 'high' | 'medium' | 'low';
export type CostOfError = 'low' | 'medium' | 'high';
export type Authority = 'verified' | 'unverified' | 'not_required';
export type Context = Record<string, unknown>;
export type TraceStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface TraceStep {
  code: string;
  label: string;
  status: TraceStatus;
  detail: string;
}

export interface Evaluation {
  decision: Decision;
  confidence: number;
  riskScore: number;
  evidenceQuality: number;
  costOfError: CostOfError;
  evidenceUsed: string[];
  missingInformation: string[];
  reversibility: Reversibility;
  authority: Authority;
  reasonCodes: string[];
  outcome: string;
  policyVersion: string;
  policyTrace: TraceStep[];
}

export interface Enforcement {
  attempted: boolean;
  executed: boolean;
  status: 'not_attempted' | 'executed' | 'prevented';
  receiptId?: string;
  message: string;
}

export interface AuditRecord extends Evaluation {
  id: string;
  domain: string;
  action: string;
  context: Context;
  enforcement: Enforcement;
  timestamp: string;
  previousHash: string;
  recordHash: string;
}

export interface AgentProposal {
  domain: string;
  action: string;
  context: Context;
  confidence: number;
  rationale: string;
  sourceFacts: string[];
  warnings: string[];
}
