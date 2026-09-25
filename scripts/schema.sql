CREATE TABLE IF NOT EXISTS thenact_audit (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  action TEXT NOT NULL,
  context JSONB NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('execute', 'ask', 'defer', 'escalate', 'refuse')),
  confidence INTEGER NOT NULL,
  risk_score INTEGER NOT NULL,
  evidence_quality INTEGER NOT NULL,
  cost_of_error TEXT NOT NULL,
  evidence_used JSONB NOT NULL,
  missing_information JSONB NOT NULL,
  reversibility TEXT NOT NULL,
  authority TEXT NOT NULL,
  reason_codes JSONB NOT NULL,
  outcome TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  policy_trace JSONB NOT NULL,
  enforcement JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  previous_hash TEXT NOT NULL,
  record_hash TEXT NOT NULL UNIQUE
);

CREATE INDEX IF NOT EXISTS thenact_audit_created_at_idx
  ON thenact_audit (created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS thenact_execution_receipts (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL,
  action TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status = 'executed'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
