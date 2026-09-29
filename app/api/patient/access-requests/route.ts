import { currentAccount } from '@/lib/server/account';
import { query } from '@/lib/server/database';
import { privateJson } from '@/lib/server/request';
import type { AccessRequestStatus } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

interface IncomingRow {
  id: string;
  doctor_id: string;
  doctor_name: string;
  doctor_email: string;
  license_number: string;
  specialization: string | null;
  organization: string | null;
  verification_status: string;
  status: AccessRequestStatus;
  request_message: string | null;
  requested_at: string;
  responded_at: string | null;
}

export async function GET() {
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);
    const result = await query<IncomingRow>(
      `select r.id, r.doctor_id, p.full_name as doctor_name, u.email as doctor_email,
              d.license_number, d.specialization, d.organization, d.verification_status,
              r.status, r.request_message, r.requested_at, r.responded_at
         from public.vediora_access_requests r
         join public.vediora_profiles p on p.id = r.doctor_id
         join public.vediora_doctor_profiles d on d.id = r.doctor_id
         join auth.users u on u.id = r.doctor_id
        where r.patient_id = $1
        order by r.requested_at desc`,
      [current.user.id],
    );
    return privateJson({ requests: result.rows });
  } catch (error) {
    console.error('Patient access requests error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'Doctor access requests could not be loaded.' }, 503);
  }
}
