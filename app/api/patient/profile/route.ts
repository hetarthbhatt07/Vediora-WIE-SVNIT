import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PROFILE_COLUMNS, parseProfileInput } from '@/lib/patient-profile';

export const dynamic = 'force-dynamic';
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });

function hasSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '');
  return !!host && origin === `${protocol}://${host}`;
}

function databaseError(code: string) {
  const setup = ['PGRST205', '42P01'].includes(code);
  return json({ error: setup ? 'Profile storage has not been set up yet. Please contact the project administrator.' : 'Your profile could not be loaded or saved. Please try again.', code: setup ? 'PROFILE_SETUP_REQUIRED' : 'PROFILE_DATABASE_ERROR' }, 503);
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Please sign in again.' }, 401);
  const { data, error } = await supabase.from('vediora_profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle();
  if (error) return databaseError(error.code);
  if (!data) return json({ error: 'Your account profile is not ready. Please contact the project administrator.', code: 'PROFILE_SETUP_REQUIRED' }, 503);
  return json({ profile: data, email: user.email });
}

export async function PATCH(request: NextRequest) {
  // Cookie-authenticated writes must originate from this application.
  if (!hasSameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: 'Please sign in again.' }, 401);
  let input;
  try { input = parseProfileInput(await request.json()); }
  catch (error) { return json({ error: error instanceof Error ? error.message : 'Invalid profile.' }, 400); }
  const { data, error } = await supabase.from('vediora_profiles').update(input).eq('id', user.id).select(PROFILE_COLUMNS).maybeSingle();
  if (error) return databaseError(error.code);
  if (!data) return json({ error: 'Your profile was not found.', code: 'PROFILE_SETUP_REQUIRED' }, 404);
  return json({ profile: data, email: user.email });
}
