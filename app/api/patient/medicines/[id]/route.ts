import { NextRequest } from 'next/server';
import { parseMedicineUpdate } from '@/lib/patient-medicines';
import { currentAccount } from '@/lib/server/account';
import { query } from '@/lib/server/database';
import { hasSameOrigin, privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!hasSameOrigin(request)) return privateJson({ error: 'Invalid request origin.' }, 403);
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);
    let input;
    try { input = parseMedicineUpdate(await request.json()); }
    catch (error) { return privateJson({ error: error instanceof Error ? error.message : 'Invalid medicine update.' }, 400); }
    const { id } = await context.params;
    const result = await query(
      `update public.vediora_patient_medicines set
         dosage = case when $3 then $4 else dosage end,
         frequency = case when $5 then $6 else frequency end,
         notes = case when $7 then $8 else notes end,
         status = case when $9 then $10 else status end
       where id = $1 and patient_id = $2
       returning id, drug_id, medicine_name, dosage, frequency, notes, status, started_at, ended_at, updated_at`,
      [id, current.user.id,
        'dosage' in input, input.dosage ?? null,
        'frequency' in input, input.frequency ?? null,
        'notes' in input, input.notes ?? null,
        'status' in input, input.status ?? null],
    );
    if (!result.rows[0]) return privateJson({ error: 'Medicine record not found.' }, 404);
    return privateJson({ medicine: result.rows[0] });
  } catch (error) {
    console.error('Update patient medicine error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The medicine could not be updated.' }, 503);
  }
}
