import { NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cronSecret = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  if (expected && cronSecret !== expected) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  // T1 placeholder: actual reconciliation runs after T4-T5 produce real data.
  // Will iterate active accounts and call reconcile_balance RPC.
  logger.info('monthly-reconcile: placeholder (T1)', {
    action: 'monthly-reconcile',
    actor_role: 'system',
    success: true,
  });

  return NextResponse.json({
    ok: true,
    note: 'T1 placeholder; real reconciliation activates after T4-T5',
    ts: new Date().toISOString(),
  });
}
