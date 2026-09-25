# ThenAct Final Submission Checklist

## Repository
- [x] Public GitHub repository is live
- [x] `main` contains the Vercel-native codebase
- [x] README shows the Vercel production URL
- [x] Judge-facing submission package is in `/submission`
- [x] No secrets are intentionally committed; environment-variable placeholders live in `.env.example`
- [x] GitHub Actions CI is green

## Vercel
- [x] Production deployment is live
- [x] Framework is Next.js
- [x] Node.js 22 is declared
- [x] Neon-backed database is configured
- [x] `/api/health` reports `databaseConfigured: true`
- [x] `/api/health` reports `databaseReady: true`
- [x] OpenRouter free inference is configured
- [x] Current production policy version is `v2026.09.2`

## Product verification
- [x] Agent Mode → Forged refund → REFUSE + WRITE PREVENTED
- [x] Safe ticket → EXECUTE + execution receipt
- [x] Ambiguous ticket → ASK
- [x] Stale fraud feed → DEFER
- [x] Risky production deployment → ESCALATE
- [x] Attack Lab includes bypass/forged-authority testing
- [x] Audit Ledger uses SHA-256 linked records
- [x] Replay is read-only and does not invoke the execution adapter
- [x] Responsive control-room UI is implemented

## DOO assets
- [x] Architecture snapshot: `submission/ARCHITECTURE.svg`
- [x] Architecture notes: `submission/ARCHITECTURE.md`
- [x] Final demo render produced: `ThenAct_90s_DOO_Demo_SUBMIT_FINAL.mp4`
- [x] Final demo duration verified: **89.5 seconds**
- [x] Deliberate failure test: `submission/FAILURE_TEST.md`
- [x] Two-year thesis: `submission/TWO_YEAR_THESIS.md`
- [x] Final submission copy: `submission/FINAL_SUBMISSION.md`
- [x] Vercel production URL is the primary live-demo URL

## Manual submission step
- [ ] Upload `ThenAct_90s_DOO_Demo_SUBMIT_FINAL.mp4` to the DOO form (or Loom only if the form requires a share URL), then paste the live app and GitHub links from `submission/FINAL_SUBMISSION.md`.
