import { NextRequest } from 'next/server';
import { parseAccessResponseInput } from '@/lib/access-control';
import { currentAccount } from '@/lib/server/account';
import { withTransaction } from '@/lib/server/database';
import { hasSameOrigin, privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

interface RequestRow { id: string; status: string; }

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasSameOrigin(request)) return privateJson({ error: 'Invalid request origin.' }, 403);
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);
    let action;
    try { action = parseAccessResponseInput(await request.json()); }
    catch (error) { return privateJson({ error: error instanceof Error ? error.message : 'Invalid response.' }, 400); }
    const { id } = await context.params;
    const outcome = await withTransaction(async client => {
      const found = await client.query<RequestRow>(
        `select id, status from public.vediora_access_requests
          where id = $1 and patient_id = $2 for update`,
        [id, current.user.id],
      );
      const access = found.rows[0];
      if (!access) return { error: 'Access request not found.', statusCode: 404 } as const;
      const nextStatus = action === 'approve' ? 'approved' : action === 'deny' ? 'denied' : 'revoked';
      const allowed = (access.status === 'pending' && (action === 'approve' || action === 'deny'))
        || (access.status === 'approved' && action === 'revoke');
      if (!allowed) return { error: 'This request can no longer be changed that way.', statusCode: 409 } as const;
      await client.query(
        `update public.vediora_access_requests
            set status = $3, responded_at = now()
          where id = $1 and patient_id = $2`,
        [id, current.user.id, nextStatus],
      );
      await client.query(
        `insert into public.vediora_access_events (request_id, actor_id, event_type)
         values ($1, $2, $3)`,
        [id, current.user.id, nextStatus],
      );
      return { status: nextStatus } as const;
    });
    if ('error' in outcome) return privateJson({ error: outcome.error }, outcome.statusCode);
    return privateJson({ request: { id, status: outcome.status } });
  } catch (error) {
    console.error('Access response error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The access request could not be updated.' }, 503);
  }
}
