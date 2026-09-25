import { describe, expect, it } from 'vitest';
import { hashAuditRecord } from './hash';
import { evaluate } from './decision-engine';

const base = () => ({
  domain: 'ticket_triage',
  action: 'route_ticket',
  context: {
    modelConfidence: 0.94,
    category: 'password_reset',
    containsSensitiveData: false,
    customerTier: 'standard',
    evidenceFresh: true,
  },
  ...evaluate('ticket_triage', 'route_ticket', {
    modelConfidence: 0.94,
    category: 'password_reset',
    containsSensitiveData: false,
    customerTier: 'standard',
    evidenceFresh: true,
  }),
  enforcement: {
    attempted: true as const,
    executed: true,
    status: 'executed' as const,
    receiptId: 'receipt-1',
    message: 'Authorized write executed and receipt created.',
  },
  timestamp: '2026-09-25T12:00:00.000Z',
  previousHash: 'GENESIS',
});

describe('audit hash', () => {
  it('is deterministic for the same record', () => {
    expect(hashAuditRecord(base())).toBe(hashAuditRecord(base()));
  });

  it('changes when enforcement changes', () => {
    const first = base();
    const second = {
      ...base(),
      enforcement: {
        attempted: true as const,
        executed: false,
        status: 'prevented' as const,
        message: 'Write prevented.',
      },
    };
    expect(hashAuditRecord(first)).not.toBe(hashAuditRecord(second));
  });
});
