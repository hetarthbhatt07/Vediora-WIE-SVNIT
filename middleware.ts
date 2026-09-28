import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { supabaseConfig } from '@/lib/supabase/config';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseConfig();
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(items) {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const protectedPage = /^\/(patient|doctor|admin)(\/|$)/.test(path) || path === '/access-pending';
  let destination: string | null = null;
  if (protectedPage && !user) destination = '/login';
  // Admin workflows remain blocked until a separately approved admin role exists.
  else if (/^\/admin(\/|$)/.test(path)) destination = '/access-pending';
  if (destination) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || request.nextUrl.host;
    const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
    const redirect = NextResponse.redirect(new URL(destination, `${protocol}://${host}`));
    response.cookies.getAll().forEach(cookie => redirect.cookies.set(cookie));
    response = redirect;
  }
  if (path.startsWith('/api/')) response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export const config = {
  matcher: ['/patient/:path*', '/doctor/:path*', '/admin/:path*', '/api/patient/:path*', '/api/doctor/:path*', '/api/account', '/access-pending'],
};
