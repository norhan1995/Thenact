# Submission Copy

## Title

ThenAct — Decision control plane for autonomous systems

## One-line description

An AI proposer interprets natural-language intent; a separate deterministic control plane decides whether it may execute, ask, defer, escalate or refuse—and only EXECUTE can reach the write.

## What makes it different

ThenAct is not another safety prompt or decision classifier. The learned model sits upstream and proposes structured intent. Authorization remains deterministic and enforceable. Unknown evidence fails closed, confidence cannot manufacture authority, and an EXECUTE receipt plus its audit record commit atomically in Postgres.

## Reviewer wow moment

Use the natural-language forged-refund instruction. The AI correctly understands the refund request, but ThenAct catches forged authority and returns REFUSE. The enforcement stage proves that no execution receipt was created.

## Deliverables

- Working build: Vercel production URL
- 90-second demo: `docs/demo-script.md`
- Architecture: Architecture view + `docs/architecture.md`
- Failure test: Agent Mode forged refund + Attack Lab + `docs/failure-test.md`
- Two-year thesis: `docs/two-year-thesis.md`
