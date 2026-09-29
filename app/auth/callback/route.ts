import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      let target = request.nextUrl.searchParams.get('next') === '/reset-password' ? '/reset-password' : '/patient/dashboard';
      if (target !== '/reset-password') {
        const { data: { user } } = await supabase.auth.getUser();
        // Navigation hint only; the destination layout verifies the database role.
        if (user?.user_metadata?.account_type === 'doctor') target = '/doctor/dashboard';
      }
      return NextResponse.redirect(new URL(target, request.url));
    }
  }
  return NextResponse.redirect(new URL('/login?error=confirmation', request.url));
}
