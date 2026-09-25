import { createHash } from 'node:crypto';
import type { AuditRecord, Context, Enforcement, Evaluation } from './types';

export interface HashableAuditBase extends Evaluation {
  domain: string;
  action: string;
  context: Context;
  enforcement: Enforcement;
  timestamp: string;
  previousHash: string;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, canonicalize(nested)])
    );
  }

  return value;
}

export function stableStringify(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function auditPayload(record: HashableAuditBase) {
  return stableStringify({
    domain: record.domain,
    action: record.action,
    context: record.context,
    decision: record.decision,
    confidence: record.confidence,
    riskScore: record.riskScore,
    evidenceQuality: record.evidenceQuality,
    costOfError: record.costOfError,
    evidenceUsed: record.evidenceUsed,
    missingInformation: record.missingInformation,
    reversibility: record.reversibility,
    authority: record.authority,
    reasonCodes: record.reasonCodes,
    outcome: record.outcome,
    policyVersion: record.policyVersion,
    policyTrace: record.policyTrace,
    enforcement: record.enforcement,
    timestamp: record.timestamp,
    previousHash: record.previousHash,
  });
}

export function hashAuditRecord(record: HashableAuditBase) {
  return `sha256:${createHash('sha256')
    .update(`${record.previousHash}|${auditPayload(record)}`)
    .digest('hex')}`;
}

export function verifyRecord(record: AuditRecord) {
  const { id: _id, recordHash, ...base } = record;
  return hashAuditRecord(base) === recordHash;
}
