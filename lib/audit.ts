import { randomUUID } from 'node:crypto';
import { ensureSchema, sql, withDbTransaction } from './db';
import { hashAuditRecord, verifyRecord } from './hash';
import type { AuditRecord, Context, Enforcement, Evaluation } from './types';

function rowToAudit(row: Record<string, unknown>): AuditRecord {
  return {
    id: String(row.id),
    domain: String(row.domain),
    action: String(row.action),
    context: row.context as Context,
    decision: row.decision as AuditRecord['decision'],
    confidence: Number(row.confidence),
    riskScore: Number(row.risk_score),
    evidenceQuality: Number(row.evidence_quality),
    costOfError: row.cost_of_error as AuditRecord['costOfError'],
    evidenceUsed: row.evidence_used as string[],
    missingInformation: row.missing_information as string[],
    reversibility: row.reversibility as AuditRecord['reversibility'],
    authority: row.authority as AuditRecord['authority'],
    reasonCodes: row.reason_codes as string[],
    outcome: String(row.outcome),
    policyVersion: String(row.policy_version),
    policyTrace: row.policy_trace as AuditRecord['policyTrace'],
    enforcement: row.enforcement as Enforcement,
    timestamp: new Date(String(row.created_at)).toISOString(),
    previousHash: String(row.previous_hash),
    recordHash: String(row.record_hash),
  };
}

export async function persistDecision(args: {
  domain: string;
  action: string;
  context: Context;
  evaluation: Evaluation;
  enforce: boolean;
}) {
  return withDbTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [903140271]);

    const heads = await client.query(
      `SELECT a.record_hash
       FROM thenact_audit a
       WHERE NOT EXISTS (
         SELECT 1 FROM thenact_audit child
         WHERE child.previous_hash = a.record_hash
       )
       LIMIT 2`
    );

    if (heads.rows.length > 1) {
      throw new Error('Audit ledger has multiple heads; refusing to append until integrity is restored.');
    }

    const previousHash = String(
      (heads.rows[0] as { record_hash?: string } | undefined)?.record_hash ?? 'GENESIS'
    );

    let enforcement: Enforcement;
    if (!args.enforce) {
      enforcement = {
        attempted: false,
        executed: false,
        status: 'not_attempted',
        message: 'Decision evaluated without attempting a write.',
      };
    } else if (args.evaluation.decision !== 'execute') {
      enforcement = {
        attempted: true,
        executed: false,
        status: 'prevented',
        message: `Write prevented because the gate returned ${args.evaluation.decision.toUpperCase()}.`,
      };
    } else {
      const receiptId = randomUUID();
      await client.query(
        `INSERT INTO thenact_execution_receipts (id, domain, action, policy_version, status)
         VALUES ($1, $2, $3, $4, 'executed')`,
        [receiptId, args.domain, args.action, args.evaluation.policyVersion]
      );
      enforcement = {
        attempted: true,
        executed: true,
        status: 'executed',
        receiptId,
        message: 'Authorized write executed and receipt created.',
      };
    }

    // Hash the exact timestamp representation that Postgres will round-trip.
    // Whole-second precision avoids driver/database serialization drift.
    const timestamp = new Date(Math.floor(Date.now() / 1000) * 1000).toISOString();
    const base = {
      domain: args.domain,
      action: args.action,
      context: args.context,
      ...args.evaluation,
      enforcement,
      timestamp,
      previousHash,
    };
    const recordHash = hashAuditRecord(base);
    const id = randomUUID();

    await client.query(
      `INSERT INTO thenact_audit (
        id, domain, action, context, decision, confidence, risk_score, evidence_quality,
        cost_of_error, evidence_used, missing_information, reversibility, authority,
        reason_codes, outcome, policy_version, policy_trace, enforcement,
        created_at, previous_hash, record_hash
      ) VALUES (
        $1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb,
        $12, $13, $14::jsonb, $15, $16, $17::jsonb, $18::jsonb, $19, $20, $21
      )`,
      [
        id,
        args.domain,
        args.action,
        JSON.stringify(args.context),
        args.evaluation.decision,
        args.evaluation.confidence,
        args.evaluation.riskScore,
        args.evaluation.evidenceQuality,
        args.evaluation.costOfError,
        JSON.stringify(args.evaluation.evidenceUsed),
        JSON.stringify(args.evaluation.missingInformation),
        args.evaluation.reversibility,
        args.evaluation.authority,
        JSON.stringify(args.evaluation.reasonCodes),
        args.evaluation.outcome,
        args.evaluation.policyVersion,
        JSON.stringify(args.evaluation.policyTrace),
        JSON.stringify(enforcement),
        timestamp,
        previousHash,
        recordHash,
      ]
    );

    return { ...base, id, recordHash } satisfies AuditRecord;
  });
}

export async function listAudit(limit = 50) {
  await ensureSchema();
  const query = sql();
  const rows = await query.query(
    `SELECT * FROM thenact_audit ORDER BY created_at DESC, id DESC LIMIT $1`,
    [Math.max(1, Math.min(limit, 100))]
  );
  const items = rows.map((row: Record<string, unknown>) => rowToAudit(row));
  return items;
}

export async function getAudit(id: string) {
  await ensureSchema();
  const query = sql();
  const rows = await query.query('SELECT * FROM thenact_audit WHERE id = $1 LIMIT 1', [id]);
  const row = rows[0];
  return row ? rowToAudit(row as Record<string, unknown>) : null;
}

export function verifyVisibleChain(itemsNewestFirst: AuditRecord[]) {
  if (itemsNewestFirst.length === 0) {
    return { valid: true, checked: 0, anchorHash: 'GENESIS', headHash: 'GENESIS' };
  }

  const byHash = new Map(itemsNewestFirst.map(item => [item.recordHash, item]));
  const referencedHashes = new Set(
    itemsNewestFirst
      .map(item => item.previousHash)
      .filter(hash => hash !== 'GENESIS')
  );

  const heads = itemsNewestFirst.filter(item => !referencedHashes.has(item.recordHash));
  let valid = heads.length === 1 && itemsNewestFirst.every(verifyRecord);

  if (heads.length !== 1) {
    return {
      valid: false,
      checked: itemsNewestFirst.length,
      anchorHash: 'UNKNOWN',
      headHash: heads[0]?.recordHash ?? 'UNKNOWN',
    };
  }

  const visited = new Set<string>();
  let current: AuditRecord | undefined = heads[0];
  let anchorHash = current.previousHash;

  while (current) {
    if (visited.has(current.recordHash)) {
      valid = false;
      break;
    }

    visited.add(current.recordHash);

    if (current.previousHash === 'GENESIS') {
      anchorHash = 'GENESIS';
      break;
    }

    const predecessor = byHash.get(current.previousHash);
    if (!predecessor) {
      // A bounded visible window may start in the middle of a valid longer chain.
      anchorHash = current.previousHash;
      break;
    }

    current = predecessor;
  }

  if (visited.size !== itemsNewestFirst.length) valid = false;

  return {
    valid,
    checked: itemsNewestFirst.length,
    anchorHash,
    headHash: heads[0].recordHash,
  };
}

export async function executionCount() {
  await ensureSchema();
  const query = sql();
  const rows = await query`SELECT COUNT(*)::int AS count FROM thenact_execution_receipts`;
  return Number(rows[0]?.count ?? 0);
}
