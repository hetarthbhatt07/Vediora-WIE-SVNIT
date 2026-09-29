import { NextRequest } from 'next/server';
import { parseDoctorProfileInput } from '@/lib/access-control';
import { currentAccount } from '@/lib/server/account';
import { query } from '@/lib/server/database';
import { hasSameOrigin, privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest) {
  if (!hasSameOrigin(request)) return privateJson({ error: 'Invalid request origin.' }, 403);
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'doctor') return privateJson({ error: 'A doctor account is required.' }, 403);
    let input;
    try { input = parseDoctorProfileInput(await request.json()); }
    catch (error) { return privateJson({ error: error instanceof Error ? error.message : 'Invalid doctor profile.' }, 400); }
    const result = await query(
      `update public.vediora_doctor_profiles
          set license_number = $2, specialization = $3, organization = $4
        where id = $1
      returning license_number, specialization, organization, verification_status, updated_at`,
      [current.user.id, input.license_number, input.specialization, input.organization],
    );
    if (!result.rows[0]) return privateJson({ error: 'Doctor profile setup is incomplete.' }, 404);
    return privateJson({ profile: result.rows[0] });
  } catch (error) {
    console.error('Doctor profile update error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The doctor profile could not be updated.' }, 503);
  }
}
