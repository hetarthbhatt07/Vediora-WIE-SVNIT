import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { highestSeverity, parseReportRequest } from '@/lib/prescriptions';
import { currentAccount } from '@/lib/server/account';
import { query, withTransaction } from '@/lib/server/database';
import { hasSameOrigin, privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

interface MedicineRow { drug_id: number; medicine_name: string; }
interface InteractionRow {
  interaction_id: number; drug1_id: number; drug2_id: number; drug1_name: string; drug2_name: string;
  severity: string | null; interaction_type: string | null; description: string | null;
  clinical_effect: string | null; evidence_source: string | null; reference_url: string | null;
}

const reportListSql = `select id, prescription_id, version, overall_severity, summary, evidence_snapshot, created_at
  from public.vediora_safety_reports where patient_id = $1 order by version desc`;

function safeUrl(value: string | null) {
  if (!value) return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null; }
  catch { return null; }
}

function cleanEvidence(value: string | null, maximum = 1200) {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > maximum ? `${clean.slice(0, maximum - 1)}…` : clean;
}

function cleanClinicalEffect(value: string | null) {
  if (!value) return null;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean.length > 800 || (clean.match(/,/g)?.length || 0) > 12 ? null : clean;
}

export async function GET() {
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);
    const result = await query(reportListSql, [current.user.id]);
    return privateJson({ reports: result.rows });
  } catch (error) {
    console.error('Load reports error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'Your reports could not be loaded.' }, 503);
  }
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request)) return privateJson({ error: 'Invalid request origin.' }, 403);
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);
    let input;
    try { input = parseReportRequest(await request.json()); }
    catch (error) { return privateJson({ error: error instanceof Error ? error.message : 'Invalid report request.' }, 400); }

    const report = await withTransaction(async client => {
      const medicines = new Map<number, string>();
      const active = await client.query<MedicineRow>(
        `select drug_id, medicine_name from public.vediora_patient_medicines
         where patient_id = $1 and status = 'active' order by updated_at desc`, [current.user.id],
      );
      active.rows.forEach(item => medicines.set(item.drug_id, item.medicine_name));
      if (input.prescription_id) {
        const owned = await client.query<MedicineRow>(
          `select i.drug_id, i.medicine_name from public.vediora_patient_prescriptions p
           join public.vediora_prescription_items i on i.prescription_id = p.id
           where p.id = $1 and p.patient_id = $2 and p.status = 'confirmed' and i.confirmed_by_patient = true`,
          [input.prescription_id, current.user.id],
        );
        if (owned.rows.length === 0) throw Object.assign(new Error('That confirmed prescription was not found.'), { status: 404 });
        owned.rows.forEach(item => medicines.set(item.drug_id, item.medicine_name));
      }
      if (medicines.size < 2) throw Object.assign(new Error('At least two confirmed or active medicines are required to generate an interaction report.'), { status: 422 });
      const entries = [...medicines.entries()].map(([drug_id, medicine_name]) => ({ drug_id, medicine_name }));
      const ids = entries.map(item => item.drug_id);
      const interactions = await client.query<InteractionRow>(
        `select i.interaction_id, i.drug1_id, i.drug2_id,
          coalesce(d1.generic_name, d1.ingredient_name, d1.brand_name, 'Unknown medicine') drug1_name,
          coalesce(d2.generic_name, d2.ingredient_name, d2.brand_name, 'Unknown medicine') drug2_name,
          i.severity, i.interaction_type, i.description, i.clinical_effect, i.evidence_source, i.reference_url
         from public.drug_interactions i join public.drugs d1 on d1.drug_id=i.drug1_id join public.drugs d2 on d2.drug_id=i.drug2_id
         where i.drug1_id = any($1::int[]) and i.drug2_id = any($1::int[])
         order by case lower(coalesce(i.severity,'')) when 'major' then 1 when 'moderate' then 2 when 'minor' then 3 else 4 end, i.interaction_id`,
        [ids],
      );
      const pairKey = (a: number, b: number) => a < b ? `${a}:${b}` : `${b}:${a}`;
      const recorded = new Set(interactions.rows.map(item => pairKey(item.drug1_id, item.drug2_id)));
      const missingPairs: string[] = [];
      for (let first = 0; first < entries.length; first += 1) for (let second = first + 1; second < entries.length; second += 1) {
        if (!recorded.has(pairKey(entries[first].drug_id, entries[second].drug_id))) missingPairs.push(`${entries[first].medicine_name} + ${entries[second].medicine_name}`);
      }
      const overallSeverity = highestSeverity(interactions.rows.map(item => item.severity));
      const summary = interactions.rows.length
        ? `Vediora found ${interactions.rows.length} documented interaction record${interactions.rows.length === 1 ? '' : 's'} among ${entries.length} medicines. Highest recorded severity: ${overallSeverity}.`
        : `Vediora found no documented interaction records among ${entries.length} medicines in the current imported database.`;
      const snapshot = {
        medicines: entries,
        findings: interactions.rows.map(item => ({
          id: item.interaction_id, pair: `${item.drug1_name} + ${item.drug2_name}`, severity: item.severity,
          type: item.interaction_type, description: cleanEvidence(item.description), clinicalEffect: cleanClinicalEffect(item.clinical_effect),
          evidenceSource: cleanEvidence(item.evidence_source), referenceUrl: safeUrl(item.reference_url),
        })),
        missingPairs,
        limitation: 'A missing database record does not prove that a combination is safe. Do not stop or change prescribed medicine without a doctor or pharmacist.',
      };
      await client.query('select pg_advisory_xact_lock(hashtextextended($1, 0))', [current.user.id]);
      const versionResult = await client.query<{ version: number }>(
        'select coalesce(max(version), 0) + 1 as version from public.vediora_safety_reports where patient_id = $1',
        [current.user.id],
      );
      const created = await client.query(
        `insert into public.vediora_safety_reports
          (id, patient_id, prescription_id, version, overall_severity, summary, evidence_snapshot, generated_by, generator_role)
         values ($1,$2,$3,$4,$5,$6,$7::jsonb,$2,'patient')
         returning id, prescription_id, version, overall_severity, summary, evidence_snapshot, created_at`,
        [randomUUID(), current.user.id, input.prescription_id, versionResult.rows[0].version, overallSeverity, summary, JSON.stringify(snapshot)],
      );
      return created.rows[0];
    });
    return privateJson({ report }, 201);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404 || status === 422) return privateJson({ error: (error as Error).message }, status);
    console.error('Generate report error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The evidence report could not be generated.' }, 503);
  }
}
