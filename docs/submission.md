# Submission Copy

## Title

ThenAct — Decision control plane for autonomous systems

## One-line description

A proposal layer interprets natural-language intent; a separate deterministic control plane decides whether it may execute, ask, defer, escalate or refuse—and only EXECUTE can reach the write.

## What makes it different

ThenAct is not another safety prompt or decision classifier. Interpretation is probabilistic, but authorization is deterministic and enforceable. Unknown evidence fails closed, confidence cannot manufacture authority, and an EXECUTE receipt plus its audit record commit atomically in Postgres. If external free inference is unavailable, a transparent narrow fallback preserves availability without gaining any authority.

## Reviewer wow moment

Use the forged-refund instruction. ThenAct identifies forged authority, returns REFUSE, and visibly proves no execution receipt was created.

## Deliverables

- Working build: https://thenact.vercel.app
- 90-second demo: `docs/demo-script.md`
- Architecture: Architecture view + `docs/architecture.md`
- Failure test: Agent Mode forged refund + Attack Lab + `docs/failure-test.md`
- Two-year thesis: `docs/two-year-thesis.md`
