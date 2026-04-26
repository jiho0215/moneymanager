import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/', '/signup', '/login', '/api/health', '/api/keepalive', '/api/cron/monthly-reconcile'];
const KID_PATHS = ['/dashboard', '/claim', '/history'];
const GUARDIAN_PATHS = ['/guardian', '/settings', '/audit', '/kid-access'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return response;

  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const role = user.user_metadata?.role as 'guardian' | 'kid' | undefined;

  if (KID_PATHS.some((p) => pathname.startsWith(p)) && role !== 'kid') {
    return NextResponse.redirect(new URL('/guardian', request.url));
  }
  if (GUARDIAN_PATHS.some((p) => pathname.startsWith(p)) && role !== 'guardian') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
