# ThenAct Build Playbook

## Purpose

Build and ship ThenAct as a reviewer-friendly, production-shaped decision-control project rather than a generic AI demo.

## Static work

- five decision outcomes
- domain policy order
- enforcement invariant: only EXECUTE can create a receipt
- audit hash format
- failure-test pass conditions
- submission narrative

## Dynamic work

- natural-language action interpretation
- model proposal confidence
- evidence extracted from user intent
- runtime audit history
- replay result under current policy

## Definition of done

- all five outcomes demonstrable
- forged-authority Agent Mode visibly fails closed
- EXECUTE visibly creates a receipt
- non-EXECUTE visibly prevents the write
- audit chain verifies
- replay has no side effect
- desktop and mobile layouts remain usable
- CI passes typecheck, tests and production build
- Vercel health endpoint reports database configured
- README, architecture, failure test, thesis and demo script match live behavior
