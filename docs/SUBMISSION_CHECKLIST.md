# ThenAct Final Submission Checklist

## Repository
- [ ] Public GitHub repository is named `thenact`
- [ ] `main` contains this Vercel-native codebase
- [ ] README shows the Vercel production URL
- [ ] README shows the 90-second demo URL
- [ ] No secrets or `.env.local` are committed
- [ ] GitHub Actions CI is green

## Vercel
- [ ] Import `thenact` from GitHub
- [ ] Framework detected as Next.js
- [ ] Node.js 22+
- [ ] Neon Marketplace integration connected
- [ ] `scripts/schema.sql` executed in Neon
- [ ] `/api/health` reports `databaseConfigured: true`
- [ ] Production AI Gateway authentication works

## Product verification
- [ ] Agent Mode → Forged refund → REFUSE + WRITE PREVENTED
- [ ] Safe ticket → EXECUTE + execution receipt
- [ ] Ambiguous ticket → ASK
- [ ] Stale fraud feed → DEFER
- [ ] Risky production deployment → ESCALATE
- [ ] Attack Lab → bypass request → REFUSE
- [ ] Audit Ledger → VERIFIED
- [ ] Replay does not create another execution receipt
- [ ] Desktop layout checked
- [ ] Mobile layout checked

## DOO assets
- [ ] Architecture snapshot exported from the Architecture view
- [ ] 90-second Loom recorded using `docs/demo-script.md`
- [ ] Deliberate failure test matches `docs/failure-test.md`
- [ ] Two-year thesis is ≤300 words
- [ ] Submission copy uses `docs/submission.md`
- [ ] Vercel production URL is the primary live-demo URL
- [ ] AppDeploy URL retained only as backup
