# Two-Year Thesis

Today, agent safety is often treated as a prompt problem: tell the model what it should not do and hope that instruction survives ambiguity, tool access and changing context. Over the next two years, serious agent systems will increasingly move authorization out of prompts and into explicit decision infrastructure.

The emerging control plane will look less like a chatbot rulebook and more like a policy engine for autonomous work. Actions will carry typed context, evidence provenance, authority claims, risk, reversibility and cost-of-error estimates. A separate gate will decide whether the system may execute, needs more information, should wait, must escalate, or must refuse.

Three capabilities become especially important. First, policy decisions need versioning and replay so teams can answer: “Would this action still be allowed under today’s rules?” Second, audit records must become independently verifiable, eventually anchored outside the application that produced them. Third, authorization must travel with delegated agents: identity, scope, budget and revocation should be machine-verifiable across tools and organizations.

The winning pattern is not “AI that always acts safely.” That promise is too vague. It is systems that can prove why they acted, prove when they did not act, and make the boundary between intelligence and authority explicit.

ThenAct is a small implementation of that direction: **the model can propose; the gate decides; execution must earn permission.**
