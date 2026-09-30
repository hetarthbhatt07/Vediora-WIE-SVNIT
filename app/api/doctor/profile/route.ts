import { NextRequest } from 'next/server';
import { parseDoctorProfileInput } from '@/lib/access-control';
import { currentAccount } from '@/lib/server/account';
import { withTransaction } from '@/lib/server/database';
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
    const profile = await withTransaction(async client => {
      const personal = await client.query(
        `update public.vediora_profiles
            set full_name = $2, phone = $3, date_of_birth = $4, gender = $5,
                blood_group = $6, height_cm = $7, weight_kg = $8
          where id = $1 and account_type = 'doctor'
        returning full_name, phone, date_of_birth, gender, blood_group, height_cm, weight_kg, updated_at`,
        [current.user.id, input.full_name, input.phone, input.date_of_birth, input.gender, input.blood_group, input.height_cm, input.weight_kg],
      );
      const professional = await client.query(
        `update public.vediora_doctor_profiles
            set license_number = $2, specialization = $3, organization = $4
          where id = $1
        returning license_number, specialization, organization, verification_status, updated_at`,
        [current.user.id, input.license_number, input.specialization, input.organization],
      );
      if (!personal.rows[0] || !professional.rows[0]) throw new Error('DOCTOR_PROFILE_INCOMPLETE');
      return { ...personal.rows[0], ...professional.rows[0] };
    });
    return privateJson({ profile });
  } catch (error) {
    if (error instanceof Error && error.message === 'DOCTOR_PROFILE_INCOMPLETE') return privateJson({ error: 'Doctor profile setup is incomplete.' }, 404);
    console.error('Doctor profile update error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The doctor profile could not be updated.' }, 503);
  }
}
