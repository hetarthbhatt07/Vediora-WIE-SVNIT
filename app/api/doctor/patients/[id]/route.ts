import { NextRequest } from 'next/server';
import { currentAccount } from '@/lib/server/account';
import { withTransaction } from '@/lib/server/database';
import { privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

interface PatientRow {
  request_id: string;
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  updated_at: string;
}

interface MedicineRow {
  id: string;
  medicine_name: string;
  generic_name: string | null;
  brand_name: string | null;
  rxcui: string | null;
  dosage: string | null;
  frequency: string | null;
  notes: string | null;
  started_at: string | null;
  updated_at: string;
}
interface PrescriptionRow { id: string; prescriber_name: string | null; prescribed_on: string | null; created_at: string; items: unknown; }
interface ReportRow { id: string; version: number; overall_severity: string; summary: string; generator_role: string | null; created_at: string; }

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'doctor') return privateJson({ error: 'A doctor account is required.' }, 403);
    const { id } = await context.params;
    const patient = await withTransaction(async client => {
      const result = await client.query<PatientRow>(
        `select r.id as request_id, p.id, p.full_name, u.email, p.phone, p.date_of_birth,
                p.gender, p.blood_group, p.height_cm, p.weight_kg, p.updated_at
           from public.vediora_access_requests r
           join public.vediora_profiles p on p.id = r.patient_id
           join auth.users u on u.id = r.patient_id
          where r.doctor_id = $1 and r.patient_id = $2 and r.status = 'approved'
          order by r.responded_at desc limit 1`,
        [current.user.id, id],
      );
      if (!result.rows[0]) return null;
      const medicines = await client.query<MedicineRow>(
        `select m.id, m.medicine_name, d.generic_name, d.brand_name, d.rxcui,
                m.dosage, m.frequency, m.notes, m.started_at, m.updated_at
           from public.vediora_patient_medicines m
           join public.drugs d on d.drug_id = m.drug_id
          where m.patient_id = $1 and m.status = 'active'
          order by m.medicine_name`,
        [id],
      );
      const prescriptions = await client.query<PrescriptionRow>(
        `select p.id, p.prescriber_name, p.prescribed_on, p.created_at,
                coalesce(json_agg(json_build_object('medicine_name', i.medicine_name, 'dosage', i.dosage, 'frequency', i.frequency)
                  order by i.created_at) filter (where i.id is not null), '[]') items
           from public.vediora_patient_prescriptions p
           left join public.vediora_prescription_items i on i.prescription_id=p.id
          where p.patient_id=$1 and p.status='confirmed'
          group by p.id order by p.created_at desc`,
        [id],
      );
      const reports = await client.query<ReportRow>(
        `select id, version, overall_severity, summary, generator_role, created_at
           from public.vediora_safety_reports where patient_id=$1 order by version desc`,
        [id],
      );
      await client.query(
        `insert into public.vediora_access_events (request_id, actor_id, event_type)
         values ($1, $2, 'profile_viewed')`,
        [result.rows[0].request_id, current.user.id],
      );
      return { profile: result.rows[0], medicines: medicines.rows, prescriptions: prescriptions.rows, reports: reports.rows };
    });
    if (!patient) return privateJson({ error: 'Patient access is not approved or has been revoked.' }, 403);
    return privateJson({ patient: patient.profile, medicines: patient.medicines, prescriptions: patient.prescriptions, reports: patient.reports });
  } catch (error) {
    console.error('Doctor patient view error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The patient profile could not be loaded.' }, 503);
  }
}
