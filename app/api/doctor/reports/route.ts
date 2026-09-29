import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { highestSeverity } from '@/lib/prescriptions';
import { currentAccount } from '@/lib/server/account';
import { query, withTransaction } from '@/lib/server/database';
import { hasSameOrigin, privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';
interface MedicineRow { drug_id: number; medicine_name: string; }
interface InteractionRow { interaction_id: number; drug1_id: number; drug2_id: number; drug1_name: string; drug2_name: string; severity: string | null; interaction_type: string | null; description: string | null; clinical_effect: string | null; evidence_source: string | null; reference_url: string | null; }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const clean = (value: string | null, max = 1200) => value ? value.replace(/\s+/g, ' ').trim().slice(0, max) : null;
const clinicalEffect = (value: string | null) => { const normalized = value?.replace(/\s+/g, ' ').trim() || ''; return normalized.length > 800 || (normalized.match(/,/g)?.length || 0) > 12 ? null : normalized || null; };
function url(value: string | null) { if (!value) return null; try { const parsed = new URL(value); return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null; } catch { return null; } }

export async function GET() {
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'doctor') return privateJson({ error: 'A doctor account is required.' }, 403);
    const result = await query(
      `select distinct on (r.id) r.id, r.patient_id, p.full_name as patient_name, r.prescription_id,
              r.version, r.overall_severity, r.summary, r.evidence_snapshot, r.generator_role, r.created_at
         from public.vediora_safety_reports r
         join public.vediora_profiles p on p.id = r.patient_id
         join public.vediora_access_requests a on a.patient_id = r.patient_id
        where a.doctor_id = $1 and a.status = 'approved'
        order by r.id, a.responded_at desc`,
      [current.user.id],
    );
    return privateJson({ reports: result.rows.sort((a, b) => Number(b.version) - Number(a.version)) });
  } catch (error) {
    console.error('Doctor reports error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'Approved patient reports could not be loaded.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return privateJson({ error: 'Invalid request origin.' }, 403);
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'doctor') return privateJson({ error: 'A doctor account is required.' }, 403);
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['patient_id', 'prescription_id'].includes(key))) return privateJson({ error: 'Invalid review request.' }, 400);
    if (typeof body.patient_id !== 'string' || !uuid.test(body.patient_id)) return privateJson({ error: 'Select an approved patient.' }, 400);
    if (body.prescription_id != null && (typeof body.prescription_id !== 'string' || !uuid.test(body.prescription_id))) return privateJson({ error: 'Invalid prescription selection.' }, 400);

    const report = await withTransaction(async client => {
      const approved = await client.query<{ request_id: string; patient_name: string }>(
        `select a.id request_id, p.full_name patient_name from public.vediora_access_requests a
         join public.vediora_profiles p on p.id=a.patient_id
         where a.doctor_id=$1 and a.patient_id=$2 and a.status='approved' order by a.responded_at desc limit 1 for update`,
        [current.user.id, body.patient_id],
      );
      if (!approved.rows[0]) throw Object.assign(new Error('Patient access is not approved or has been revoked.'), { status: 403 });
      const medicines = new Map<number, string>();
      const active = await client.query<MedicineRow>('select drug_id, medicine_name from public.vediora_patient_medicines where patient_id=$1 and status=\'active\'', [body.patient_id]);
      active.rows.forEach(item => medicines.set(item.drug_id, item.medicine_name));
      if (body.prescription_id) {
        const items = await client.query<MedicineRow>(`select i.drug_id,i.medicine_name from public.vediora_patient_prescriptions p join public.vediora_prescription_items i on i.prescription_id=p.id where p.id=$1 and p.patient_id=$2 and p.status='confirmed'`, [body.prescription_id, body.patient_id]);
        if (!items.rows.length) throw Object.assign(new Error('The selected patient prescription is unavailable.'), { status: 404 });
        items.rows.forEach(item => medicines.set(item.drug_id, item.medicine_name));
      }
      if (medicines.size < 2) throw Object.assign(new Error('This patient needs at least two confirmed or active medicines for a clinical review.'), { status: 422 });
      const entries = [...medicines.entries()].map(([drug_id, medicine_name]) => ({ drug_id, medicine_name })); const ids = entries.map(item => item.drug_id);
      const found = await client.query<InteractionRow>(`select i.interaction_id,i.drug1_id,i.drug2_id,coalesce(d1.generic_name,d1.ingredient_name,d1.brand_name,'Unknown medicine') drug1_name,coalesce(d2.generic_name,d2.ingredient_name,d2.brand_name,'Unknown medicine') drug2_name,i.severity,i.interaction_type,i.description,i.clinical_effect,i.evidence_source,i.reference_url from public.drug_interactions i join public.drugs d1 on d1.drug_id=i.drug1_id join public.drugs d2 on d2.drug_id=i.drug2_id where i.drug1_id=any($1::int[]) and i.drug2_id=any($1::int[]) order by case lower(coalesce(i.severity,'')) when 'major' then 1 when 'moderate' then 2 when 'minor' then 3 else 4 end`, [ids]);
      const key = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`; const recorded = new Set(found.rows.map(item => key(item.drug1_id,item.drug2_id))); const missingPairs:string[]=[];
      for(let a=0;a<entries.length;a++) for(let b=a+1;b<entries.length;b++) if(!recorded.has(key(entries[a].drug_id,entries[b].drug_id))) missingPairs.push(`${entries[a].medicine_name} + ${entries[b].medicine_name}`);
      const overall = highestSeverity(found.rows.map(item => item.severity));
      const summary = found.rows.length ? `Vediora found ${found.rows.length} documented interaction record${found.rows.length===1?'':'s'} among ${entries.length} medicines. Highest recorded severity: ${overall}.` : `Vediora found no documented interaction records among ${entries.length} medicines in the current imported database.`;
      const snapshot = { medicines: entries, findings: found.rows.map(item => ({ id:item.interaction_id,pair:`${item.drug1_name} + ${item.drug2_name}`,severity:item.severity,type:item.interaction_type,description:clean(item.description),clinicalEffect:clinicalEffect(item.clinical_effect),evidenceSource:clean(item.evidence_source),referenceUrl:url(item.reference_url) })), missingPairs, limitation:'A missing database record does not prove that a combination is safe. Clinical decisions require patient-specific assessment and pharmacist or prescriber review.' };
      await client.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[body.patient_id]);
      const version = await client.query<{version:number}>('select coalesce(max(version),0)+1 version from public.vediora_safety_reports where patient_id=$1',[body.patient_id]);
      const created = await client.query(`insert into public.vediora_safety_reports (id,patient_id,prescription_id,version,overall_severity,summary,evidence_snapshot,generated_by,generator_role) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,'doctor') returning id,patient_id,prescription_id,version,overall_severity,summary,evidence_snapshot,generator_role,created_at`,[randomUUID(),body.patient_id,body.prescription_id||null,version.rows[0].version,overall,summary,JSON.stringify(snapshot),current.user.id]);
      await client.query(`insert into public.vediora_access_events (request_id,actor_id,event_type) values ($1,$2,'profile_viewed')`,[approved.rows[0].request_id,current.user.id]);
      return { ...created.rows[0], patient_name: approved.rows[0].patient_name };
    });
    return privateJson({ report }, 201);
  } catch (error) {
    const status=(error as {status?:number}).status; if(status) return privateJson({error:(error as Error).message},status);
    console.error('Doctor clinical review error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The clinical review could not be generated.' }, 503);
  }
}
