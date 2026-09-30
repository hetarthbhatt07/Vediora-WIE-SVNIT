import { currentAccount } from '@/lib/server/account';
import { query } from '@/lib/server/database';
import { privateJson } from '@/lib/server/request';
import type { AccessRequestStatus } from '@/lib/access-control';

export const dynamic = 'force-dynamic';

interface DoctorRow {
  full_name: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  license_number: string;
  specialization: string | null;
  organization: string | null;
  verification_status: string;
}

interface RequestRow {
  id: string;
  patient_id: string;
  patient_name: string;
  patient_email: string;
  status: AccessRequestStatus;
  request_message: string | null;
  requested_at: string;
  responded_at: string | null;
}

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

interface WorkspaceSummaryRow {
  approved_patients: number;
  pending_requests: number;
  active_medicines: number;
  accessible_reports: number;
}

interface RecentReportRow {
  id: string;
  patient_id: string;
  patient_name: string;
  version: number;
  overall_severity: string;
  summary: string;
  generator_role: string | null;
  created_at: string;
}

export async function GET() {
  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'doctor') return privateJson({ error: 'A doctor account is required.' }, 403);

    const [doctor, requests, patients, summary, recentReports] = await Promise.all([
      query<DoctorRow>(
        `select p.full_name, p.phone, p.date_of_birth, p.gender, p.blood_group,
                p.height_cm, p.weight_kg, d.license_number, d.specialization,
                d.organization, d.verification_status
           from public.vediora_doctor_profiles d
           join public.vediora_profiles p on p.id = d.id
          where d.id = $1`,
        [current.user.id],
      ),
      query<RequestRow>(
        `select r.id, r.patient_id, p.full_name as patient_name, u.email as patient_email,
                r.status, r.request_message, r.requested_at, r.responded_at
           from public.vediora_access_requests r
           join public.vediora_profiles p on p.id = r.patient_id
           join auth.users u on u.id = r.patient_id
          where r.doctor_id = $1
          order by r.requested_at desc`,
        [current.user.id],
      ),
      query<PatientRow>(
        `select * from (
           select distinct on (p.id) r.id as request_id, p.id, p.full_name, u.email, p.phone, p.date_of_birth,
                  p.gender, p.blood_group, p.height_cm, p.weight_kg, p.updated_at
             from public.vediora_access_requests r
             join public.vediora_profiles p on p.id = r.patient_id
             join auth.users u on u.id = r.patient_id
            where r.doctor_id = $1 and r.status = 'approved'
            order by p.id, r.responded_at desc nulls last
         ) approved_patients order by full_name`,
        [current.user.id],
      ),
      query<WorkspaceSummaryRow>(
        `select
          (select count(distinct patient_id)::int from public.vediora_access_requests where doctor_id = $1 and status = 'approved') as approved_patients,
          (select count(*)::int from public.vediora_access_requests where doctor_id = $1 and status = 'pending') as pending_requests,
          (select count(*)::int from public.vediora_patient_medicines m where m.status = 'active' and exists (
             select 1 from public.vediora_access_requests a where a.doctor_id = $1 and a.patient_id = m.patient_id and a.status = 'approved'
           )) as active_medicines,
          (select count(*)::int from public.vediora_safety_reports s where exists (
             select 1 from public.vediora_access_requests a where a.doctor_id = $1 and a.patient_id = s.patient_id and a.status = 'approved'
           )) as accessible_reports`,
        [current.user.id],
      ),
      query<RecentReportRow>(
        `select s.id, s.patient_id, p.full_name as patient_name, s.version, s.overall_severity,
                s.summary, s.generator_role, s.created_at
           from public.vediora_safety_reports s
           join public.vediora_profiles p on p.id = s.patient_id
          where exists (
            select 1 from public.vediora_access_requests a
             where a.doctor_id = $1 and a.patient_id = s.patient_id and a.status = 'approved'
          )
          order by s.created_at desc limit 4`,
        [current.user.id],
      ),
    ]);
    if (!doctor.rows[0]) return privateJson({ error: 'Doctor profile setup is incomplete.' }, 503);

    return privateJson({
      doctor: {
        id: current.user.id,
        fullName: doctor.rows[0].full_name,
        email: current.user.email || null,
        phone: doctor.rows[0].phone,
        dateOfBirth: doctor.rows[0].date_of_birth,
        gender: doctor.rows[0].gender,
        bloodGroup: doctor.rows[0].blood_group,
        heightCm: doctor.rows[0].height_cm,
        weightKg: doctor.rows[0].weight_kg,
        licenseNumber: doctor.rows[0].license_number,
        specialization: doctor.rows[0].specialization,
        organization: doctor.rows[0].organization,
        verificationStatus: doctor.rows[0].verification_status,
      },
      requests: requests.rows,
      patients: patients.rows,
      summary: summary.rows[0] || { approved_patients: 0, pending_requests: 0, active_medicines: 0, accessible_reports: 0 },
      recentReports: recentReports.rows,
    });
  } catch (error) {
    console.error('Doctor workspace error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'The doctor workspace could not be loaded.' }, 503);
  }
}
