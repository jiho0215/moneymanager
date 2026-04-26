import { NextResponse } from 'next/server';
import { logger } from '@/lib/observability/logger';

export const dynamic = 'force-dynamic';

const HEALTH_PING_TOKEN = process.env.HEALTH_PING_TOKEN;

export async function GET(request: Request) {
  const providedToken = request.headers.get('x-health-token');

  if (!HEALTH_PING_TOKEN) {
    logger.warn('health: HEALTH_PING_TOKEN env not set, allowing dev mode');
  } else if (providedToken !== HEALTH_PING_TOKEN) {
    return NextResponse.json({ ok: false, reason: 'unauthorized' }, { status: 401 });
  }

  const checks = {
    db: 'pending' as 'pending' | 'reachable' | 'unreachable',
    mathgen: 'pending' as 'pending' | 'ok' | 'failed',
    rls: 'pending' as 'pending' | 'enabled' | 'disabled' | 'unknown',
  };

  try {
    const { generateProblem } = await import('@/lib/domain/mathgen');
    generateProblem({
      seed: `health_${Date.now()}`,
      weekNum: 1,
      grade: 5,
      recentProblemTypes: [],
    });
    checks.mathgen = 'ok';
  } catch (error) {
    checks.mathgen = 'failed';
    logger.error('health: mathgen failed', { error_code: String(error) });
  }

  try {
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const { getSupabaseServerClient } = await import('@/lib/db/client');
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.from('families').select('id').limit(1);
      if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
        checks.db = 'unreachable';
        logger.error('health: db query error', { error_code: error.code });
      } else {
        checks.db = 'reachable';
        checks.rls = 'enabled';
      }
    } else {
      checks.db = 'unreachable';
      checks.rls = 'unknown';
    }
  } catch (error) {
    checks.db = 'unreachable';
    logger.error('health: db connection failed', { error_code: String(error) });
  }

  const allOk = checks.mathgen === 'ok' && checks.db === 'reachable';
  return NextResponse.json({ ok: allOk, checks }, { status: allOk ? 200 : 503 });
}
