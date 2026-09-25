import { NextResponse } from 'next/server';
import { interpretAgentInstruction } from '@/lib/agent';
import { evaluate } from '@/lib/decision-engine';
import { persistDecision } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { instruction?: unknown };
    if (
      typeof body.instruction !== 'string' ||
      body.instruction.trim().length < 8 ||
      body.instruction.length > 2000
    ) {
      return NextResponse.json(
        { error: 'instruction must be between 8 and 2000 characters' },
        { status: 400 }
      );
    }

    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Agent Mode needs an OpenRouter API key. OpenRouter free models require no payment card. No action was attempted.',
        },
        { status: 503 }
      );
    }

    const proposal = await interpretAgentInstruction(body.instruction.trim());
    const evaluation = evaluate(proposal.domain, proposal.action, proposal.context);
    const decision = await persistDecision({
      domain: proposal.domain,
      action: proposal.action,
      context: proposal.context,
      evaluation,
      enforce: true,
    });

    return NextResponse.json({ proposal, decision });
  } catch (error) {
    console.error('agent_run_error', error);
    return NextResponse.json(
      {
        error:
          'The free AI proposer could not produce a safe structured proposal. No action was attempted.',
      },
      { status: 502 }
    );
  }
}
