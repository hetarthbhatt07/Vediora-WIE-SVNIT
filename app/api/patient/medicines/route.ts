import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { normalizeMedicineText } from '@/lib/medicine-chat';
import { parseNewMedicine } from '@/lib/patient-medicines';
import { currentAccount } from '@/lib/server/account';
import { query } from '@/lib/server/database';
import { hasSameOrigin, privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

interface DrugRow { drug_id: number; generic_name: string | null; brand_name: string | null; ingredient_name: string | null; }
interface MedicineRow {
  id: string;
  drug_id: number;
  medicine_name: string;
  generic_name: string | null;
  brand_name: string | null;
  rxcui: string | null;
  dosage: string | null;
  frequency: string | null;
  notes: string | null;
  status: 'active' | 'discontinued';
  started_at: string | null;
  ended_at: string | null;
  updated_at: string;
}

const medicineSelect = `select m.id, m.drug_id, m.medicine_name, d.generic_name, d.brand_name, d.rxcui,
  m.dosage, m.frequency, m.notes, m.status, m.started_at, m.ended_at, m.updated_at
  from public.vediora_patient_medicines m join public.drugs d on d.drug_id = m.drug_id`;

export async function GET() {
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);
    const result = await query<MedicineRow>(`${medicineSelect} where m.patient_id = $1 order by (m.status = 'active') desc, m.updated_at desc`, [current.user.id]);
    return privateJson({ medicines: result.rows });
  } catch (error) {
    console.error('Patient medicines error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'Your medicine list could not be loaded.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return privateJson({ error: 'Invalid request origin.' }, 403);
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);
    let input;
    try { input = parseNewMedicine(await request.json()); }
    catch (error) { return privateJson({ error: error instanceof Error ? error.message : 'Invalid medicine.' }, 400); }
    const normalized = normalizeMedicineText(input.medicine_name);
    const canonical = ['aspirin', 'asa'].includes(normalized) ? 'acetylsalicylic acid' : normalized;
    const match = await query<DrugRow>(
      `select drug_id, generic_name, brand_name, ingredient_name from public.drugs
        where lower(trim(coalesce(generic_name, ''))) = $1
           or lower(trim(coalesce(brand_name, ''))) = $1
           or lower(trim(coalesce(ingredient_name, ''))) = $1
        order by case when lower(trim(coalesce(generic_name, ''))) = $1 then 1 else 2 end, drug_id
        limit 2`,
      [canonical],
    );
    if (match.rows.length === 0) return privateJson({ error: 'That medicine name was not found in Vediora’s imported database. Enter an exact generic or brand name.' }, 422);
    if (match.rows.length > 1 && match.rows[0].generic_name !== match.rows[1].generic_name) return privateJson({ error: 'That medicine name is ambiguous. Please enter its exact generic name.' }, 409);
    const drug = match.rows[0];
    const display = drug.generic_name || drug.ingredient_name || drug.brand_name || input.medicine_name;
    try {
      const inserted = await query<MedicineRow>(
        `with created as (
           insert into public.vediora_patient_medicines
             (id, patient_id, drug_id, medicine_name, dosage, frequency, notes, started_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8)
           returning *
         )
         select c.id, c.drug_id, c.medicine_name, d.generic_name, d.brand_name, d.rxcui,
                c.dosage, c.frequency, c.notes, c.status, c.started_at, c.ended_at, c.updated_at
           from created c join public.drugs d on d.drug_id = c.drug_id`,
        [randomUUID(), current.user.id, drug.drug_id, display, input.dosage, input.frequency, input.notes, input.started_at],
      );
      return privateJson({ medicine: inserted.rows[0] }, 201);
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return privateJson({ error: 'This medicine is already active in your list. Update the existing record instead.' }, 409);
      throw error;
    }
  } catch (error) {
    console.error('Add patient medicine error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The medicine could not be saved.' }, 503);
  }
}
