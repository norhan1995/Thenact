import { NextResponse } from 'next/server';
import { evaluate } from '@/lib/decision-engine';
import { persistDecision } from '@/lib/audit';
import type { Context } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      domain?: unknown;
      action?: unknown;
      context?: unknown;
      enforce?: unknown;
    };

    if (
      typeof body.domain !== 'string' ||
      typeof body.action !== 'string' ||
      typeof body.context !== 'object' ||
      body.context === null ||
      Array.isArray(body.context)
    ) {
      return NextResponse.json({ error: 'domain, action and context are required' }, { status: 400 });
    }

    const context = body.context as Context;
    const evaluation = evaluate(body.domain, body.action, context);
    const record = await persistDecision({
      domain: body.domain,
      action: body.action,
      context,
      evaluation,
      enforce: body.enforce === true,
    });

    return NextResponse.json(record);
  } catch (error) {
    console.error('gate_error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Decision gate failed.' },
      { status: 500 }
    );
  }
}
