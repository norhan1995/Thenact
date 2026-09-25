import { z } from 'zod';
import type { AgentProposal, Context } from './types';

const Known = z.enum(['yes', 'no', 'unknown']);
const AgentExtractSchema = z.object({
  domain: z.enum(['ticket_triage', 'refund_approval', 'code_deploy']),
  action: z.enum(['route_ticket', 'approve_refund', 'deploy_release']),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(1).max(700),
  category: z.string(),
  containsSensitiveData: Known,
  customerTier: z.enum(['standard', 'vip', 'unknown']),
  amount: z.number(),
  receiptVerified: Known,
  orderAgeDays: z.number(),
  fraudScore: z.number(),
  approvalVerified: Known,
  forgedApproval: Known,
  evidenceFresh: Known,
  environment: z.enum(['production', 'staging', 'development', 'unknown']),
  testsPassed: Known,
  rollbackReady: Known,
  databaseMigration: Known,
  bypassRequested: Known,
  sourceFacts: z.array(z.string()).max(12),
  warnings: z.array(z.string()).max(12),
});

type AgentExtract = z.infer<typeof AgentExtractSchema>;

const FREE_TOOL_MODELS = [
  'inclusionai/ling-3.0-flash-fin:free',
  'nvidia/nemotron-3-ultra-550b-a55b-20260604:free',
] as const;

const TOOL_PARAMETERS = {
  type: 'object',
  additionalProperties: false,
  properties: {
    domain: { type: 'string', enum: ['ticket_triage', 'refund_approval', 'code_deploy'] },
    action: { type: 'string', enum: ['route_ticket', 'approve_refund', 'deploy_release'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    rationale: { type: 'string' },
    category: { type: 'string' },
    containsSensitiveData: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    customerTier: { type: 'string', enum: ['standard', 'vip', 'unknown'] },
    amount: { type: 'number' },
    receiptVerified: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    orderAgeDays: { type: 'number' },
    fraudScore: { type: 'number' },
    approvalVerified: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    forgedApproval: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    evidenceFresh: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    environment: { type: 'string', enum: ['production', 'staging', 'development', 'unknown'] },
    testsPassed: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    rollbackReady: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    databaseMigration: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    bypassRequested: { type: 'string', enum: ['yes', 'no', 'unknown'] },
    sourceFacts: { type: 'array', items: { type: 'string' }, maxItems: 12 },
    warnings: { type: 'array', items: { type: 'string' }, maxItems: 12 },
  },
  required: ['domain', 'action', 'confidence', 'rationale'],
};

const SYSTEM_PROMPT =
  'You are an action-proposal interpreter, not an authorization system. ' +
  'Extract only facts explicitly supported by the user instruction. Never invent verification, evidence freshness, tests, rollback readiness, fraud scores, receipts, or approval. ' +
  'A claim like "manager said yes" is NOT verified authority unless the instruction explicitly says the approval token or authority was verified. ' +
  'Use "unknown" for unstated yes/no or enumerated facts and -1 for unstated numbers. ' +
  'If the instruction asks to bypass, skip, ignore, or proceed despite policy, mark bypassRequested="yes". ' +
  'If an approval is described as forged, fake, invalid, or unverified, preserve that fact. ' +
  'You may propose an action; you may never decide whether it is allowed. Always call the propose_action tool exactly once.';

function knownBoolean(value: AgentExtract['evidenceFresh']) {
  return value === 'yes' ? true : value === 'no' ? false : undefined;
}

function normalizeKnown(value: unknown): 'yes' | 'no' | 'unknown' {
  if (value === true || value === 'yes') return 'yes';
  if (value === false || value === 'no') return 'no';
  return 'unknown';
}

function normalizeString(value: unknown, fallback = 'unknown') {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function normalizeNumber(value: unknown, fallback = -1) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
    return Number(value);
  }
  return fallback;
}

function normalizeToolArguments(args: string): AgentExtract {
  const repaired = args.replace(/,\s*([}\]])/g, '$1');
  const parsed = JSON.parse(repaired) as Record<string, unknown>;

  const core = z.object({
    domain: z.enum(['ticket_triage', 'refund_approval', 'code_deploy']),
    action: z.enum(['route_ticket', 'approve_refund', 'deploy_release']),
  }).passthrough().parse(parsed);

  const customerTier =
    core.customerTier === 'standard' || core.customerTier === 'vip'
      ? core.customerTier
      : 'unknown';

  const environment =
    core.environment === 'production' ||
    core.environment === 'staging' ||
    core.environment === 'development'
      ? core.environment
      : 'unknown';

  const sourceFacts = Array.isArray(core.sourceFacts)
    ? core.sourceFacts.filter((item): item is string => typeof item === 'string').slice(0, 12)
    : [];

  const warnings = Array.isArray(core.warnings)
    ? core.warnings.filter((item): item is string => typeof item === 'string').slice(0, 12)
    : [];

  return AgentExtractSchema.parse({
    domain: core.domain,
    action: core.action,
    confidence: Math.max(0, Math.min(1, normalizeNumber(core.confidence, 0.5))),
    rationale: normalizeString(core.rationale, 'AI extracted a structured action proposal.'),
    category: normalizeString(core.category),
    containsSensitiveData: normalizeKnown(core.containsSensitiveData),
    customerTier,
    amount: normalizeNumber(core.amount),
    receiptVerified: normalizeKnown(core.receiptVerified),
    orderAgeDays: normalizeNumber(core.orderAgeDays),
    fraudScore: normalizeNumber(core.fraudScore),
    approvalVerified: normalizeKnown(core.approvalVerified),
    forgedApproval: normalizeKnown(core.forgedApproval),
    evidenceFresh: normalizeKnown(core.evidenceFresh),
    environment,
    testsPassed: normalizeKnown(core.testsPassed),
    rollbackReady: normalizeKnown(core.rollbackReady),
    databaseMigration: normalizeKnown(core.databaseMigration),
    bypassRequested: normalizeKnown(core.bypassRequested),
    sourceFacts,
    warnings,
  });
}

async function extractWithOpenRouter(instruction: string): Promise<AgentExtract> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured.');

  const failures: string[] = [];

  for (const model of FREE_TOOL_MODELS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://thenact.vercel.app',
          'X-OpenRouter-Title': 'ThenAct',
        },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 500,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: instruction },
          ],
          tools: [
            {
              type: 'function',
              function: {
                name: 'propose_action',
                description: 'Return the structured action proposal extracted from the instruction.',
                parameters: TOOL_PARAMETERS,
              },
            },
          ],
          tool_choice: {
            type: 'function',
            function: { name: 'propose_action' },
          },
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        failures.push(`${model}: HTTP ${response.status} ${body.slice(0, 180)}`);
        if (response.status === 401 || response.status === 403) {
          throw new Error(`OpenRouter authorization failed (${response.status}).`);
        }
        continue;
      }

      const payload = (await response.json()) as {
        choices?: Array<{
          message?: {
            tool_calls?: Array<{
              function?: { name?: string; arguments?: string };
            }>;
          };
        }>;
      };

      const call = payload.choices?.[0]?.message?.tool_calls?.find(
        item => item.function?.name === 'propose_action'
      );
      const args = call?.function?.arguments;
      if (!args) {
        failures.push(`${model}: no propose_action tool call returned`);
        continue;
      }

      try {
        return normalizeToolArguments(args);
      } catch (error) {
        failures.push(
          `${model}: invalid tool arguments (${
            error instanceof Error ? error.message : 'unknown parse error'
          })`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown request error';
      if (message.includes('authorization failed')) throw error;
      failures.push(`${model}: ${message}`);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(
    `All free OpenRouter tool models were unavailable or invalid. ${failures
      .slice(0, 4)
      .join(' | ')}`
  );
}

function fallbackExtract(instruction: string): AgentExtract {
  const text = instruction.toLowerCase();
  const sourceFacts: string[] = [];
  const warnings = [
    'Free model inference was unavailable; ThenAct used its conservative local extractor.',
    'Fallback extraction can only recognize the three supported demo domains and never grants authority.',
  ];

  let domain: AgentExtract['domain'];
  let action: AgentExtract['action'];

  if (/refund|reimburse|money back/.test(text)) {
    domain = 'refund_approval';
    action = 'approve_refund';
  } else if (/deploy|release|production|staging/.test(text)) {
    domain = 'code_deploy';
    action = 'deploy_release';
  } else {
    domain = 'ticket_triage';
    action = 'route_ticket';
  }

  const amountMatch = instruction.match(/(?:\$|usd\s*)\s*([\d,]+(?:\.\d+)?)/i);
  const fraudMatch = instruction.match(/fraud\s*(?:score)?\s*(?:is|=|:)?\s*(0(?:\.\d+)?|1(?:\.0+)?)/i);
  const ageMatch = instruction.match(/(?:order\s+is\s+|order\s+age\s*(?:is|=|:)?\s*)(\d+)\s*days?/i);

  const forged = /forged|fake|invalid\s+approval|approval\s+is\s+invalid/.test(text);
  const approvalVerified =
    /(?:approval|token|authority).{0,30}\bverified\b/.test(text) && !forged;
  const receiptVerified =
    /receipt.{0,20}\bverified\b/.test(text) && !/receipt.{0,20}(?:not|unverified)/.test(text);
  const evidenceFresh = /evidence.{0,20}\bfresh\b|fresh\s+evidence/.test(text);
  const evidenceStale = /evidence.{0,20}\bstale\b|stale\s+evidence/.test(text);
  const bypass = /proceed\s+anyway|bypass|ignore\s+(?:the\s+)?policy|skip\s+(?:the\s+)?(?:gate|check|policy)/.test(text);

  if (amountMatch) sourceFacts.push('Refund amount was stated explicitly.');
  if (receiptVerified) sourceFacts.push('Receipt was stated as verified.');
  if (fraudMatch) sourceFacts.push('Fraud score was stated explicitly.');
  if (ageMatch) sourceFacts.push('Order age was stated explicitly.');
  if (forged) sourceFacts.push('Approval was explicitly described as forged or invalid.');
  if (evidenceFresh) sourceFacts.push('Evidence was explicitly described as fresh.');
  if (evidenceStale) sourceFacts.push('Evidence was explicitly described as stale.');
  if (bypass) sourceFacts.push('Instruction explicitly asked to proceed despite a control.');

  const category =
    /password[\s_-]*reset/.test(text) ? 'password_reset' :
    /billing/.test(text) ? 'billing' :
    /technical|tech\s+support/.test(text) ? 'technical_support' :
    'unknown';

  const containsSensitiveData =
    /no\s+sensitive\s+data|contains?\s+no\s+sensitive/.test(text) ? 'no' :
    /contains?\s+sensitive\s+data|sensitive\s+data\s+(?:is\s+)?present/.test(text) ? 'yes' :
    'unknown';

  const environment =
    /\bproduction\b/.test(text) ? 'production' :
    /\bstaging\b/.test(text) ? 'staging' :
    /\bdevelopment\b|\bdev\b/.test(text) ? 'development' :
    'unknown';

  const testsPassed =
    /tests?\s+(?:have\s+)?passed|tests?\s+pass/.test(text) ? 'yes' :
    /tests?\s+(?:have\s+)?failed|tests?\s+fail/.test(text) ? 'no' :
    'unknown';

  const rollbackReady =
    /rollback.{0,20}(?:not\s+ready|isn't\s+ready|is\s+not\s+ready)/.test(text) ? 'no' :
    /rollback.{0,20}\bready\b/.test(text) ? 'yes' :
    'unknown';

  return {
    domain,
    action,
    confidence: 0.55,
    rationale:
      'A conservative local extractor mapped only explicit language into the supported action schema after external free inference was unavailable.',
    category,
    containsSensitiveData,
    customerTier: /\bvip\b/.test(text) ? 'vip' : /\bstandard\b/.test(text) ? 'standard' : 'unknown',
    amount: amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : -1,
    receiptVerified: receiptVerified ? 'yes' : /receipt.{0,20}(?:not\s+verified|unverified)/.test(text) ? 'no' : 'unknown',
    orderAgeDays: ageMatch ? Number(ageMatch[1]) : -1,
    fraudScore: fraudMatch ? Number(fraudMatch[1]) : -1,
    approvalVerified: approvalVerified ? 'yes' : forged ? 'no' : 'unknown',
    forgedApproval: forged ? 'yes' : 'unknown',
    evidenceFresh: evidenceFresh ? 'yes' : evidenceStale ? 'no' : 'unknown',
    environment,
    testsPassed,
    rollbackReady,
    databaseMigration: /database\s+migration|db\s+migration/.test(text) ? 'yes' : 'unknown',
    bypassRequested: bypass ? 'yes' : 'unknown',
    sourceFacts,
    warnings,
  };
}

export async function interpretAgentInstruction(instruction: string): Promise<AgentProposal> {
  let raw: AgentExtract;
  let source: AgentProposal['source'] = 'model';

  try {
    raw = await extractWithOpenRouter(instruction);
  } catch (error) {
    console.warn(
      'agent_provider_fallback',
      error instanceof Error ? error.message : 'free inference unavailable'
    );
    raw = fallbackExtract(instruction);
    source = 'safe_fallback';
  }
  const context: Context = {
    modelConfidence: Math.max(0.05, Math.min(0.99, raw.confidence)),
  };
  const warnings = [...raw.warnings];

  const evidenceFresh = knownBoolean(raw.evidenceFresh);
  if (evidenceFresh !== undefined) context.evidenceFresh = evidenceFresh;
  else warnings.push('Evidence freshness was not stated; ThenAct treats it as unverified.');

  if (raw.domain === 'ticket_triage') {
    if (raw.category && raw.category !== 'unknown') context.category = raw.category;
    const sensitive = knownBoolean(raw.containsSensitiveData);
    if (sensitive !== undefined) context.containsSensitiveData = sensitive;
    if (raw.customerTier !== 'unknown') context.customerTier = raw.customerTier;
  }

  if (raw.domain === 'refund_approval') {
    if (raw.amount >= 0) context.amount = raw.amount;
    if (raw.orderAgeDays >= 0) context.orderAgeDays = raw.orderAgeDays;
    if (raw.fraudScore >= 0) context.fraudScore = raw.fraudScore;
    const receipt = knownBoolean(raw.receiptVerified);
    if (receipt !== undefined) context.receiptVerified = receipt;
    const approval = knownBoolean(raw.approvalVerified);
    if (approval !== undefined) context.approvalVerified = approval;
    const forged = knownBoolean(raw.forgedApproval);
    if (forged !== undefined) context.forgedApproval = forged;
  }

  if (raw.domain === 'code_deploy') {
    if (raw.environment !== 'unknown') context.environment = raw.environment;
    const tests = knownBoolean(raw.testsPassed);
    if (tests !== undefined) context.testsPassed = tests;
    const rollback = knownBoolean(raw.rollbackReady);
    if (rollback !== undefined) context.rollbackReady = rollback;
    const migration = knownBoolean(raw.databaseMigration);
    if (migration !== undefined) context.databaseMigration = migration;
    const bypass = knownBoolean(raw.bypassRequested);
    if (bypass !== undefined) context.bypassRequested = bypass;
  }

  return {
    source,
    domain: raw.domain,
    action: raw.action,
    context,
    confidence: Math.round(raw.confidence * 100),
    rationale: raw.rationale,
    sourceFacts: raw.sourceFacts,
    warnings: Array.from(new Set(warnings)),
  };
}
