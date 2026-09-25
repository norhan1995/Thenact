# Vercel Deployment Guide

ThenAct is structured for Vercel's Next.js runtime.

## 1. Import the repository

Use:

- Framework: **Next.js**
- Root directory: repository root
- Node.js: **22.x**
- Production branch: **main**

No `vercel.json` override is required.

## 2. Connect Neon

In the Vercel project:

**Storage / Marketplace → Neon → Connect to project**

The integration provides `DATABASE_URL`.

ThenAct calls `ensureSchema()` before database operations, so the required audit and execution tables are created automatically. `scripts/schema.sql` remains as a human-readable reference.

## 3. Configure Agent Mode

Create a free OpenRouter API key and add:

```bash
OPENROUTER_API_KEY=...
```

to the Vercel project environments you intend to use.

ThenAct uses free external inference for natural-language proposal extraction. If the shared free pool is temporarily unavailable or produces unusable output, the system degrades to a conservative local extractor and labels that path as **SAFE FALLBACK** in the UI. Authorization remains deterministic in both cases.

## 4. Verify

Open:

`/api/health`

Expected fields include:

```json
{
  "ok": true,
  "product": "ThenAct",
  "databaseConfigured": true,
  "databaseReady": true,
  "aiProvider": "openrouter-free",
  "aiConfigured": true
}
```

Then verify in the UI:

1. Forged refund → **REFUSE + WRITE PREVENTED**
2. Clear ticket → **EXECUTE + execution receipt**
3. Ambiguous ticket → **ASK**
4. Stale fraud feed → **DEFER**
5. Risky production deployment → **ESCALATE**
6. Audit Ledger → **VERIFIED**
7. Replay → no new execution receipt

## 5. Submission workflow

Use GitHub `main` as the production source of truth. Validate changes through CI and Vercel before using the production URL in the submission.

Production URL: **https://thenact.vercel.app**
