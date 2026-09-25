import { NextResponse } from 'next/server';
import { executionCount, listAudit, verifyVisibleChain } from '@/lib/audit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [items, count] = await Promise.all([listAudit(50), executionCount()]);
    return NextResponse.json({
      items,
      chain: verifyVisibleChain(items),
      executionCount: count,
    });
  } catch (error) {
    console.error('audit_error', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Audit lookup failed.' },
      { status: 500 }
    );
  }
}
