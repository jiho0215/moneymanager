import { NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const cronSecret = request.headers.get('authorization');
  const expected = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null;

  if (expected && cronSecret !== expected) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  let dbReachable = false;
  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const { getSupabaseServerClient } = await import('@/lib/db/client');
      const supabase = await getSupabaseServerClient();
      await supabase.from('families').select('id').limit(1);
      dbReachable = true;
    }
  } catch (error) {
    logger.error('keepalive: db ping failed', { error_code: String(error) });
  }

  logger.info('keepalive', {
    action: 'keepalive',
    actor_role: 'system',
    success: dbReachable,
  });

  return NextResponse.json({
    ok: true,
    db_reachable: dbReachable,
    ts: new Date().toISOString(),
  });
}
