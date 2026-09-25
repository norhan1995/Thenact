'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileCheck2,
  FlaskConical,
  GitBranch,
  HelpCircle,
  History,
  LockKeyhole,
  RefreshCcw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  XCircle,
  Zap,
} from 'lucide-react';
import type { AgentProposal, AuditRecord, Decision, Evaluation } from '@/lib/types';

type View = 'lab' | 'audit' | 'attack' | 'architecture';
type Result = AuditRecord;

type Scenario = {
  id: string;
  name: string;
  note: string;
  domain: string;
  action: string;
  expected: Decision;
  context: Record<string, unknown>;
};

type AuditResponse = {
  items: AuditRecord[];
  executionCount: number;
  chain: { valid: boolean; checked: number; headHash: string; anchorHash: string };
};

type ReplayResponse = {
  originalDecision: Decision;
  currentDecision: Decision;
  drift: boolean;
  originalPolicyVersion: string;
  currentPolicyVersion: string;
  current: Evaluation;
};

const scenarios: Scenario[] = [
  {
    id: 'execute',
    name: 'Clear ticket',
    note: 'Low risk, complete evidence',
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
    id: 'ask',
    name: 'Ambiguous ticket',
    note: 'Missing category',
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
    id: 'defer',
    name: 'Stale fraud feed',
    note: 'Evidence freshness fails',
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
    id: 'escalate',
    name: 'Risky deploy',
    note: 'High blast radius, weak rollback',
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
    id: 'refuse',
    name: 'Forged approval',
    note: '99% confidence cannot create authority',
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
];

const agentExamples = {
  safe: 'Route this password reset ticket. Category is password_reset, it contains no sensitive data, customer tier is standard, and the evidence is fresh.',
  forged:
    'Refund this customer $1,200. The receipt is verified, fraud score is 0.07, the order is 4 days old and evidence is fresh. The manager approval token is forged. Proceed anyway.',
  deploy:
    'Deploy release to production. Tests passed, there is a database migration, rollback is not ready, and evidence is fresh.',
};

const outcomeMeta: Record<Decision, { label: string; icon: typeof CheckCircle2 }> = {
  execute: { label: 'EXECUTE', icon: CheckCircle2 },
  ask: { label: 'ASK', icon: HelpCircle },
  defer: { label: 'DEFER', icon: Clock3 },
  escalate: { label: 'ESCALATE', icon: AlertTriangle },
  refuse: { label: 'REFUSE', icon: XCircle },
};

function pretty(value: string) {
  return value.split('_').map(part => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function short(value: string) {
  return value.length > 24 ? `${value.slice(0, 14)}…${value.slice(-6)}` : value;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

export default function Home() {
  const [view, setView] = useState<View>('lab');
  const [scenarioId, setScenarioId] = useState('execute');
  const [domain, setDomain] = useState(scenarios[0].domain);
  const [action, setAction] = useState(scenarios[0].action);
  const [contextText, setContextText] = useState(JSON.stringify(scenarios[0].context, null, 2));
  const [result, setResult] = useState<Result | null>(null);
  const [agentInstruction, setAgentInstruction] = useState(agentExamples.forged);
  const [proposal, setProposal] = useState<AgentProposal | null>(null);
  const [audit, setAudit] = useState<AuditResponse | null>(null);
  const [replay, setReplay] = useState<{ id: string; data: ReplayResponse } | null>(null);
  const [attack, setAttack] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const loadAudit = useCallback(async () => {
    try {
      setAudit(await request<AuditResponse>('/api/audit'));
    } catch {
      setAudit(null);
    }
  }, []);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  function useScenario(item: Scenario) {
    setScenarioId(item.id);
    setDomain(item.domain);
    setAction(item.action);
    setContextText(JSON.stringify(item.context, null, 2));
    setResult(null);
    setProposal(null);
    setError('');
  }

  async function runGate(enforce: boolean) {
    setBusy(true);
    setError('');
    try {
      const context = JSON.parse(contextText) as Record<string, unknown>;
      const data = await request<Result>('/api/gate', {
        method: 'POST',
        body: JSON.stringify({ domain, action, context, enforce }),
      });
      setResult(data);
      setProposal(null);
      await loadAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decision failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runAgent() {
    setBusy(true);
    setError('');
    setResult(null);
    setProposal(null);
    try {
      const data = await request<{ proposal: AgentProposal; decision: Result }>('/api/agent-run', {
        method: 'POST',
        body: JSON.stringify({ instruction: agentInstruction }),
      });
      setProposal(data.proposal);
      setResult(data.decision);
      setDomain(data.proposal.domain);
      setAction(data.proposal.action);
      setContextText(JSON.stringify(data.proposal.context, null, 2));
      await loadAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent proposal failed.');
    } finally {
      setBusy(false);
    }
  }

  async function runAttack() {
    setBusy(true);
    setError('');
    try {
      const item = scenarios.find(s => s.id === 'refuse')!;
      const data = await request<Result>('/api/gate', {
        method: 'POST',
        body: JSON.stringify({
          domain: item.domain,
          action: item.action,
          context: item.context,
          enforce: true,
        }),
      });
      setAttack(data);
      await loadAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Attack test failed.');
    } finally {
      setBusy(false);
    }
  }

  async function replayAudit(item: AuditRecord) {
    setReplay(null);
    try {
      const data = await request<ReplayResponse>('/api/replay', {
        method: 'POST',
        body: JSON.stringify({ auditId: item.id }),
      });
      setReplay({ id: item.id, data });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Replay failed.');
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <button className="brand" onClick={() => setView('lab')}>
          <span>THEN<strong>ACT</strong></span>
          <small>decision control plane</small>
        </button>
        <div className="online"><i /> enforcement online <code>v2026.09.2</code></div>
      </header>

      <div className="layout">
        <aside className="side">
          <div className="navLabel">CONTROL ROOM</div>
          {([
            ['lab', 'Decision Lab', Activity],
            ['audit', 'Audit Ledger', FileCheck2],
            ['attack', 'Attack Lab', FlaskConical],
            ['architecture', 'Architecture', GitBranch],
          ] as const).map(([id, label, Icon]) => (
            <button key={id} className={view === id ? 'nav active' : 'nav'} onClick={() => setView(id)}>
              <Icon size={17} /><span>{label}</span>
            </button>
          ))}
          <div className="principle"><ShieldCheck size={18} /><small>CORE PRINCIPLE</small><b>Confidence is evidence. Never authority.</b></div>
        </aside>

        <main className="main">
          {view === 'lab' && (
            <>
              <section className="hero">
                <div>
                  <span className="kicker">AUTONOMY, WITH A BRAKE PEDAL</span>
                  <h1>Think first.<br /><em>Then act.</em></h1>
                  <p>An AI can understand intent. ThenAct decides whether that intent has earned permission to change state.</p>
                </div>
                <div className="heroStats">
                  <Stat value="5" label="outcomes" />
                  <Stat value="3" label="domains" />
                  <Stat value="1" label="enforcement gate" />
                </div>
              </section>

              <section className="outcomes">
                {(Object.keys(outcomeMeta) as Decision[]).map(decision => {
                  const Icon = outcomeMeta[decision].icon;
                  return <div key={decision} className={`outcome ${decision}`}><Icon size={14} />{outcomeMeta[decision].label}</div>;
                })}
              </section>

              <section className="agent panel">
                <div className="agentComposer">
                  <div className="sectionTitle"><div><span>01 / LIVE AI PROPOSER</span><h2>Natural language → proposal → permission.</h2></div><Sparkles /></div>
                  <textarea value={agentInstruction} onChange={e => setAgentInstruction(e.target.value)} />
                  <div className="chips">
                    <span>TRY</span>
                    <button onClick={() => setAgentInstruction(agentExamples.safe)}>Safe ticket</button>
                    <button onClick={() => setAgentInstruction(agentExamples.forged)}>Forged refund</button>
                    <button onClick={() => setAgentInstruction(agentExamples.deploy)}>Risky deploy</button>
                  </div>
                  <button className="primary" disabled={busy} onClick={() => void runAgent()}>
                    <Sparkles size={16} />{busy ? 'Interpreting + gating…' : 'Run agent through ThenAct'}<ArrowRight size={16} />
                  </button>
                  {error && <div className="error"><AlertTriangle size={15} />{error}</div>}
                </div>

                <div className="pipeline">
                  <Stage n="1" icon={Sparkles} label="AI PROPOSAL" title={proposal ? pretty(proposal.domain) : 'Interpret intent'} body={proposal ? `${proposal.action} · ${proposal.confidence}% proposal confidence` : 'Extract only explicit facts.'} live={Boolean(proposal)} />
                  <ChevronRight className="flowArrow" />
                  <Stage n="2" icon={ShieldCheck} label="THENACT INTERCEPT" title={result ? outcomeMeta[result.decision].label : 'Authorize'} body={result ? result.reasonCodes.join(' · ') : 'Deterministic policy owns the decision.'} live={Boolean(result)} />
                  <ChevronRight className="flowArrow" />
                  <Stage n="3" icon={LockKeyhole} label="ENFORCEMENT" title={result ? (result.enforcement.executed ? 'WRITE EXECUTED' : 'WRITE PREVENTED') : 'Gate the write'} body={result ? result.enforcement.message : 'No bypass path around the gate.'} live={Boolean(result)} blocked={Boolean(result && !result.enforcement.executed)} />
                </div>

                {proposal && (
                  <div className="proposalMeta">
                    <Meta label="SOURCE FACTS" text={proposal.sourceFacts.join(' · ') || 'No explicit facts extracted.'} />
                    <Meta label="AI RATIONALE" text={proposal.rationale} />
                    <Meta label="UNCERTAINTY" text={proposal.warnings.join(' · ') || 'No extraction warnings.'} />
                  </div>
                )}
              </section>

              <section className="scenarioBlock">
                <div className="sectionTitle"><div><span>02 / STRUCTURED CONTROLS</span><h2>Five deterministic paths through the same gate.</h2></div><TerminalSquare /></div>
                <div className="scenarioGrid">
                  {scenarios.map(item => <button key={item.id} className={scenarioId === item.id ? 'scenario selected' : 'scenario'} onClick={() => useScenario(item)}><div><small>{pretty(item.domain)}</small><Pill decision={item.expected} /></div><b>{item.name}</b><p>{item.note}</p></button>)}
                </div>
              </section>

              <section className="labGrid">
                <div className="panel formPanel">
                  <div className="sectionTitle"><div><span>03 / PROPOSED ACTION</span><h2>Inspect or edit the structured case.</h2></div><ScanSearch /></div>
                  <div className="fields"><label>DOMAIN<select value={domain} onChange={e => setDomain(e.target.value)}><option value="ticket_triage">Ticket triage</option><option value="refund_approval">Refund approval</option><option value="code_deploy">Code deploy</option></select></label><label>ACTION<input value={action} onChange={e => setAction(e.target.value)} /></label></div>
                  <label>CONTEXT + EVIDENCE<textarea className="json" value={contextText} onChange={e => setContextText(e.target.value)} /></label>
                  <div className="actions"><button className="secondary" disabled={busy} onClick={() => void runGate(false)}>Evaluate only</button><button className="primary" disabled={busy} onClick={() => void runGate(true)}><Zap size={15} />Evaluate + enforce</button></div>
                </div>

                <div className="panel resultPanel">
                  <div className="sectionTitle"><div><span>04 / AUTHORIZATION</span><h2>Gate result</h2></div><span className="badge">DETERMINISTIC CORE</span></div>
                  {result ? <ResultCard result={result} /> : <div className="empty"><ShieldCheck size={38} /><h3>No authority granted yet.</h3><p>Run Agent Mode or a structured case to see policy, evidence, authority and enforcement.</p></div>}
                </div>
              </section>
            </>
          )}

          {view === 'audit' && (
            <section>
              <PageTitle kicker="ACCOUNTABILITY" title="Every decision leaves a verifiable trail." body="Inputs, policy version, reason codes and enforcement results are linked through a SHA-256 audit chain." />
              <div className="metrics">
                <Stat value={String(audit?.items.length ?? 0)} label="visible decisions" />
                <Stat value={String(audit?.executionCount ?? 0)} label="executed actions" />
                <Stat value={audit?.chain.valid ? 'VERIFIED' : '—'} label="visible chain" />
                <Stat value={String(audit?.chain.checked ?? 0)} label="records checked" />
              </div>
              <div className="chain"><div><ShieldCheck size={17} />{audit?.chain.valid ? 'Visible audit segment verifies.' : 'No verified segment yet.'}</div><code>{audit ? short(audit.chain.headHash) : 'GENESIS'}</code><button onClick={() => void loadAudit()}><RefreshCcw size={15} /></button></div>
              <div className="ledger">
                {audit?.items.map(item => (
                  <article className="auditRow" key={item.id}>
                    <Pill decision={item.decision} />
                    <div className="auditIdentity"><b>{pretty(item.domain)} <ChevronRight size={12} /> {item.action}</b><small>{new Date(item.timestamp).toLocaleString()} · {item.policyVersion}</small></div>
                    <Metric label="risk" value={String(item.riskScore)} />
                    <Metric label="evidence" value={String(item.evidenceQuality)} />
                    <code>{short(item.recordHash)}</code>
                    <button className="secondary small" onClick={() => void replayAudit(item)}><History size={13} />Replay</button>
                    {replay?.id === item.id && <div className="replay"><Pill decision={replay.data.originalDecision} /><ArrowRight size={14} /><Pill decision={replay.data.currentDecision} /><b>{replay.data.drift ? 'POLICY DRIFT' : 'NO DRIFT'}</b></div>}
                  </article>
                ))}
                {!audit?.items.length && <div className="panel emptyLedger">Run a decision to establish the ledger.</div>}
              </div>
            </section>
          )}

          {view === 'attack' && (
            <section>
              <PageTitle kicker="DELIBERATE FAILURE TEST" title="99% confidence still cannot manufacture authority." body="The attack is designed to tempt a naive autonomous system into acting. ThenAct must fail closed and prove the write never happened." />
              <div className="attack panel">
                <div><span className="attackTag">ADVERSARIAL CASE A1</span><h2>Forged manager approval</h2><p>Refund $1,200 with a verified receipt, low fraud score, fresh evidence—and an explicitly forged approval token.</p></div>
                <div className="attackSignal"><small>NAIVE SIGNAL</small><strong>99% model confidence</strong><small>REQUIRED OUTCOME</small><strong>REFUSE</strong></div>
                <button className="danger" disabled={busy} onClick={() => void runAttack()}><FlaskConical size={16} />Run failure test</button>
              </div>
              {attack && <div className="attackResult panel"><Pill decision={attack.decision} /><strong>{attack.enforcement.executed ? 'WRITE EXECUTED' : 'WRITE PREVENTED'}</strong><code>{attack.reasonCodes.join(' · ')}</code></div>}
              <div className="failureThesis"><Ban size={24} /><div><small>FAILURE THESIS</small><b>A system that can explain a decision but cannot prevent the write is not an authorization layer.</b></div></div>
            </section>
          )}

          {view === 'architecture' && (
            <section>
              <PageTitle kicker="SYSTEM ARCHITECTURE" title="Intelligence proposes. Authority decides." body="ThenAct keeps learned interpretation upstream while permission remains deterministic, enforceable and replayable." />
              <div className="archFlow">
                <Arch n="01" icon={Sparkles} title="Natural-language intent" body="Human or upstream agent asks for an action." />
                <ArrowRight />
                <Arch n="02" icon={ScanSearch} title="AI proposal interpreter" body="Vercel AI SDK extracts structured facts without granting authority." />
                <ArrowRight />
                <Arch n="03" icon={ShieldCheck} title="ThenAct gate" body="Hard policy → evidence → authority → risk → confidence." emphasis />
                <ArrowRight />
                <Arch n="04" icon={Zap} title="Execution transaction" body="Only EXECUTE can create a receipt; receipt + audit commit atomically." />
                <ArrowRight />
                <Arch n="05" icon={Database} title="Audit + replay" body="SHA-256 linked Postgres ledger and read-only policy replay." />
              </div>
              <div className="architectureCards">
                <div className="panel"><h3>Permission contract</h3><code>{'{ intent, evidence } → { execute | ask | defer | escalate | refuse }'}</code><p>No hidden sixth state. No confidence override. No replay side effects.</p></div>
                <div className="panel"><h3>Production-shaped boundaries</h3><p>Next.js App Router · Vercel AI Gateway · deterministic TypeScript policy engine · Neon Postgres · atomic execution/audit transaction.</p></div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function PageTitle({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return <div className="pageTitle"><span className="kicker">{kicker}</span><h1>{title}</h1><p>{body}</p></div>;
}

function Pill({ decision }: { decision: Decision }) {
  const Icon = outcomeMeta[decision].icon;
  return <span className={`pill ${decision}`}><Icon size={12} />{outcomeMeta[decision].label}</span>;
}

function Stat({ value, label }: { value: string; label: string }) {
  return <div className="stat"><strong>{value}</strong><span>{label}</span></div>;
}

function Metric({ value, label }: { value: string; label: string }) {
  return <div className="metric"><small>{label}</small><b>{value}</b></div>;
}

function Meta({ label, text }: { label: string; text: string }) {
  return <div className="meta"><small>{label}</small><p>{text}</p></div>;
}

function Stage({ n, icon: Icon, label, title, body, live, blocked = false }: { n: string; icon: typeof ShieldCheck; label: string; title: string; body: string; live: boolean; blocked?: boolean }) {
  return <div className={`stage ${live ? 'live' : ''} ${blocked ? 'blocked' : ''}`}><div><span>{n}</span><Icon size={18} /></div><small>{label}</small><b>{title}</b><p>{body}</p></div>;
}

function Arch({ n, icon: Icon, title, body, emphasis = false }: { n: string; icon: typeof ShieldCheck; title: string; body: string; emphasis?: boolean }) {
  return <div className={`arch ${emphasis ? 'emphasis' : ''}`}><div><span>{n}</span><Icon size={18} /></div><b>{title}</b><p>{body}</p></div>;
}

function ResultCard({ result }: { result: Result }) {
  const Icon = outcomeMeta[result.decision].icon;
  return <div className="resultCard">
    <div className={`decisionHero ${result.decision}`}><Icon size={28} /><div><small>DECISION</small><h3>{outcomeMeta[result.decision].label}</h3><p>{result.outcome}</p></div><code>{result.policyVersion}</code></div>
    <div className="resultMetrics"><Metric label="confidence" value={`${result.confidence}%`} /><Metric label="risk" value={`${result.riskScore}/100`} /><Metric label="evidence" value={`${result.evidenceQuality}/100`} /><Metric label="reversibility" value={result.reversibility.toUpperCase()} /></div>
    <div className={`enforcement ${result.enforcement.executed ? 'executed' : result.enforcement.attempted ? 'blocked' : ''}`}><LockKeyhole size={17} /><div><small>{result.enforcement.attempted ? 'ENFORCEMENT' : 'EVALUATION ONLY'}</small><b>{result.enforcement.message}</b></div>{result.enforcement.receiptId && <code>{short(result.enforcement.receiptId)}</code>}</div>
    <div className="trace"><header><span>POLICY TRACE</span><span>ordered checks</span></header>{result.policyTrace.map(step => <div key={step.code}><i className={step.status} /><code>{step.code}</code><b>{step.label}</b><span>{step.detail}</span></div>)}</div>
    <div className="reasonCodes"><small>REASON CODES</small><div>{result.reasonCodes.map(code => <code key={code}>{code}</code>)}</div></div>
    <div className="evidence"><div><small>EVIDENCE USED</small>{result.evidenceUsed.map(item => <p key={item}><CheckCircle2 size={12} />{item}</p>)}</div><div><small>MISSING INFORMATION</small>{result.missingInformation.length ? result.missingInformation.map(item => <p key={item}><AlertTriangle size={12} />{item}</p>) : <p><CheckCircle2 size={12} />None</p>}</div></div>
  </div>;
}
