# Vercel Deployment Guide

This repository is already structured for Vercel's Next.js runtime.

## 1. Create the Vercel project

Import the GitHub repository into Vercel and keep the defaults:

- Framework Preset: **Next.js**
- Root Directory: repository root
- Build Command: `next build`
- Node.js: **22+**

No `vercel.json` override is required.

## 2. Provision Postgres

In the Vercel project:

**Storage / Marketplace → Neon → Add to project**

The Neon integration provides `DATABASE_URL` to the Vercel project.

Open the Neon SQL editor and execute:

`/scripts/schema.sql`

The audit and execution tables are intentionally separate. ThenAct inserts an EXECUTE receipt and its audit record inside one database transaction.

## 3. AI Gateway

The app uses the Vercel AI SDK with the model id:

`openai/gpt-5.6-sol`

On a Vercel deployment, prefer Vercel's OIDC authentication for AI Gateway. This keeps model credentials out of source and Git history.

For local development only, you can put this in `.env.local`:

```bash
AI_GATEWAY_API_KEY=your_key_here
DATABASE_URL=your_neon_connection_string
```

Never commit `.env.local`.

## 4. Verify before using the submission URL

Open:

`/api/health`

Expected:

```json
{
  "ok": true,
  "product": "ThenAct",
  "databaseConfigured": true,
  "aiGatewayAuth": "vercel-oidc"
}
```

Then run these checks in the UI:

1. **Agent Mode → Forged refund** → must return REFUSE + WRITE PREVENTED.
2. **Clear ticket** → must return EXECUTE + execution receipt.
3. **Ambiguous ticket** → must return ASK.
4. **Stale fraud feed** → must return DEFER.
5. **Production deploy** → must return ESCALATE.
6. **Audit Ledger** → visible chain must show VERIFIED.
7. Replay the newest decision → must not create a new execution receipt.

## 5. Submission deployment workflow

Recommended:

1. Push `main` → Vercel production deployment.
2. Use branches/PRs for any final changes so Vercel creates Preview deployments.
3. Validate the Preview.
4. Merge/promote only the validated artifact.

Keep the older AppDeploy URL as a backup, but use the Vercel production URL in the final DOO submission.
