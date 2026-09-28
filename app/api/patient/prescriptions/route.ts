import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { normalizeMedicineText } from '@/lib/medicine-chat';
import { parsePrescription } from '@/lib/prescriptions';
import { currentAccount } from '@/lib/server/account';
import { query, withTransaction } from '@/lib/server/database';
import { hasSameOrigin, privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

interface DrugRow { drug_id: number; generic_name: string | null; brand_name: string | null; ingredient_name: string | null; }

const listSql = `select p.id, p.prescriber_name, p.prescribed_on, p.source_type, p.source_filename,
  p.notes, p.status, p.created_at,
  coalesce(json_agg(json_build_object(
    'id', i.id, 'drug_id', i.drug_id, 'medicine_name', i.medicine_name,
    'dosage', i.dosage, 'frequency', i.frequency, 'duration', i.duration,
    'instructions', i.instructions, 'confirmed_by_patient', i.confirmed_by_patient,
    'added_to_profile', i.added_to_profile
  ) order by i.created_at) filter (where i.id is not null), '[]') as items
  from public.vediora_patient_prescriptions p
  left join public.vediora_prescription_items i on i.prescription_id = p.id
  where p.patient_id = $1
  group by p.id order by p.created_at desc`;

export async function GET() {
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);
    const result = await query(listSql, [current.user.id]);
    return privateJson({ prescriptions: result.rows });
  } catch (error) {
    console.error('Load prescriptions error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'Your prescriptions could not be loaded.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return privateJson({ error: 'Invalid request origin.' }, 403);
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);
    let input;
    try { input = parsePrescription(await request.json()); }
    catch (error) { return privateJson({ error: error instanceof Error ? error.message : 'Invalid prescription.' }, 400); }

    const prescriptionId = randomUUID();
    await withTransaction(async client => {
      const matched: Array<{ item: typeof input.items[number]; drug: DrugRow; display: string }> = [];
      for (const item of input.items) {
        const normalized = normalizeMedicineText(item.medicine_name);
        const canonical = ['aspirin', 'asa'].includes(normalized) ? 'acetylsalicylic acid' : normalized;
        const result = await client.query<DrugRow>(
          `select drug_id, generic_name, brand_name, ingredient_name from public.drugs
           where lower(trim(coalesce(generic_name, ''))) = $1
              or lower(trim(coalesce(brand_name, ''))) = $1
              or lower(trim(coalesce(ingredient_name, ''))) = $1
           order by case when lower(trim(coalesce(generic_name, ''))) = $1 then 1 else 2 end, drug_id limit 2`,
          [canonical],
        );
        if (result.rows.length === 0) throw Object.assign(new Error(`“${item.medicine_name}” was not found in the imported medicine database.`), { status: 422 });
        if (result.rows.length > 1 && result.rows[0].generic_name !== result.rows[1].generic_name) {
          throw Object.assign(new Error(`“${item.medicine_name}” is ambiguous. Enter its exact generic name.`), { status: 409 });
        }
        const drug = result.rows[0];
        matched.push({ item, drug, display: drug.generic_name || drug.ingredient_name || drug.brand_name || item.medicine_name });
      }

      await client.query(
        `insert into public.vediora_patient_prescriptions
          (id, patient_id, prescriber_name, prescribed_on, source_type, notes, status)
         values ($1, $2, $3, $4, 'manual', $5, 'confirmed')`,
        [prescriptionId, current.user.id, input.prescriber_name, input.prescribed_on, input.notes],
      );
      for (const { item, drug, display } of matched) {
        await client.query(
          `insert into public.vediora_prescription_items
            (id, prescription_id, drug_id, medicine_name, dosage, frequency, duration, instructions, confirmed_by_patient, added_to_profile)
           values ($1, $2, $3, $4, $5, $6, $7, $8, true, $9)`,
          [randomUUID(), prescriptionId, drug.drug_id, display, item.dosage, item.frequency, item.duration, item.instructions, item.add_to_profile],
        );
        if (item.add_to_profile) {
          await client.query(
            `insert into public.vediora_patient_medicines
              (id, patient_id, drug_id, medicine_name, dosage, frequency, notes, source, started_at)
             values ($1, $2, $3, $4, $5, $6, $7, 'prescription', $8)
             on conflict (patient_id, drug_id) where status = 'active' do update
               set dosage = coalesce(excluded.dosage, vediora_patient_medicines.dosage),
                   frequency = coalesce(excluded.frequency, vediora_patient_medicines.frequency),
                   notes = coalesce(excluded.notes, vediora_patient_medicines.notes),
                   source = 'prescription'`,
            [randomUUID(), current.user.id, drug.drug_id, display, item.dosage, item.frequency, item.instructions, input.prescribed_on],
          );
        }
      }
    });
    const result = await query(`${listSql.replace('where p.patient_id = $1', 'where p.patient_id = $1 and p.id = $2')}`, [current.user.id, prescriptionId]);
    return privateJson({ prescription: result.rows[0] }, 201);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 409 || status === 422) return privateJson({ error: (error as Error).message }, status);
    console.error('Save prescription error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The prescription could not be saved.' }, 503);
  }
}
