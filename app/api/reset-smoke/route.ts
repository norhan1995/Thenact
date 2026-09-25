import { NextResponse } from 'next/server';
import { withDbTransaction } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('confirm') !== 'reset-smoke-2026') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const removed = await withDbTransaction(async client => {
    await client.query('DELETE FROM thenact_execution_receipts');
    const audit = await client.query('DELETE FROM thenact_audit RETURNING id');
    return audit.rows.length;
  });

  return NextResponse.json({ ok: true, auditRowsRemoved: removed });
}
