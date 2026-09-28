import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { parseAccessRequestInput } from '@/lib/access-control';
import { currentAccount } from '@/lib/server/account';
import { withTransaction } from '@/lib/server/database';
import { hasSameOrigin, privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

interface TargetRow { id: string; account_type: string; }
interface ExistingRow { id: string; status: string; }

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return privateJson({ error: 'Invalid request origin.' }, 403);
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'doctor') return privateJson({ error: 'A doctor account is required.' }, 403);
    let input;
    try { input = parseAccessRequestInput(await request.json()); }
    catch (error) { return privateJson({ error: error instanceof Error ? error.message : 'Invalid access request.' }, 400); }

    const outcome = await withTransaction(async client => {
      const target = await client.query<TargetRow>(
        `select p.id, p.account_type
           from auth.users u join public.vediora_profiles p on p.id = u.id
          where lower(u.email) = $1`,
        [input.patient_email],
      );
      const patient = target.rows[0];
      if (!patient || patient.account_type !== 'patient') return { error: 'No patient account was found for that email.', status: 404 } as const;
      if (patient.id === current.user.id) return { error: 'You cannot request access to your own account.', status: 400 } as const;
      const existing = await client.query<ExistingRow>(
        `select id, status from public.vediora_access_requests
          where doctor_id = $1 and patient_id = $2 and status in ('pending', 'approved')
          order by requested_at desc limit 1 for update`,
        [current.user.id, patient.id],
      );
      if (existing.rows[0]?.status === 'pending') return { error: 'An access request is already pending for this patient.', status: 409 } as const;
      if (existing.rows[0]?.status === 'approved') return { error: 'This patient has already approved your access.', status: 409 } as const;
      const id = randomUUID();
      await client.query(
        `insert into public.vediora_access_requests
          (id, doctor_id, patient_id, status, request_message)
         values ($1, $2, $3, 'pending', $4)`,
        [id, current.user.id, patient.id, input.message],
      );
      await client.query(
        `insert into public.vediora_access_events (request_id, actor_id, event_type)
         values ($1, $2, 'requested')`,
        [id, current.user.id],
      );
      return { id } as const;
    });
    if ('error' in outcome) return privateJson({ error: outcome.error }, outcome.status);
    return privateJson({ request: { id: outcome.id, status: 'pending' } }, 201);
  } catch (error) {
    console.error('Create access request error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The access request could not be created.' }, 503);
  }
}
