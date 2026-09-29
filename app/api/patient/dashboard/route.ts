import { createClient } from '@/lib/supabase/server';
import { PROFILE_COLUMNS, type PatientProfile } from '@/lib/patient-profile';
import type {
  DashboardAccessRequest,
  DashboardMedicine,
  DashboardPrescription,
  DashboardReport,
  PatientDashboardData,
} from '@/lib/patient-dashboard';
import { currentAccount } from '@/lib/server/account';
import { query } from '@/lib/server/database';
import { privateJson } from '@/lib/server/request';

export const dynamic = 'force-dynamic';

interface CountedMedicine extends DashboardMedicine { total_count: string; }
interface CountedPrescription extends Omit<DashboardPrescription, 'item_count'> { item_count: string; total_count: string; }
interface CountedReport extends DashboardReport { total_count: string; }
interface CountedAccess extends DashboardAccessRequest { approved_count: string; pending_count: string; }

function emptyDashboard(profile: PatientProfile, email: string): PatientDashboardData {
  return {
    profile,
    email,
    stats: { activeMedicines: 0, prescriptions: 0, reports: 0, approvedDoctors: 0, pendingRequests: 0 },
    medicines: [],
    prescriptions: [],
    latestReport: null,
    accessRequests: [],
  };
}

async function testDashboard() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return privateJson({ error: 'Please sign in again.' }, 401);
  const { data, error } = await supabase.from('vediora_profiles').select(PROFILE_COLUMNS).eq('id', user.id).maybeSingle();
  if (error) {
    const setup = ['PGRST205', '42P01'].includes(error.code);
    return privateJson({ error: setup ? 'Profile storage has not been set up yet. Please contact the project administrator.' : 'Your dashboard could not be loaded.' }, 503);
  }
  if (!data) return privateJson({ error: 'Your account profile is not ready. Please contact the project administrator.' }, 503);
  return privateJson(emptyDashboard(data as PatientProfile, user.email || ''));
}

export async function GET() {
  if (process.env.VEDIORA_TEST_BUILD === '1' && !process.env.DATABASE_URL) return testDashboard();

  try {
    const current = await currentAccount();
    if (!current) return privateJson({ error: 'Please sign in again.' }, 401);
    if (current.account.account_type !== 'patient') return privateJson({ error: 'A patient account is required.' }, 403);

    const patientId = current.user.id;
    const [profileResult, medicineResult, prescriptionResult, reportResult, accessResult] = await Promise.all([
      query<PatientProfile>(`select ${PROFILE_COLUMNS} from public.vediora_profiles where id = $1`, [patientId]),
      query<CountedMedicine>(
        `select id, medicine_name, dosage, frequency, updated_at, count(*) over ()::text as total_count
           from public.vediora_patient_medicines
          where patient_id = $1 and status = 'active'
          order by updated_at desc limit 4`, [patientId],
      ),
      query<CountedPrescription>(
        `select p.id, p.prescriber_name, p.prescribed_on, p.status, p.created_at,
                count(i.id)::text as item_count, count(*) over ()::text as total_count
           from public.vediora_patient_prescriptions p
           left join public.vediora_prescription_items i on i.prescription_id = p.id
          where p.patient_id = $1 and p.status <> 'archived'
          group by p.id order by p.created_at desc limit 3`, [patientId],
      ),
      query<CountedReport>(
        `select id, version, overall_severity, summary, created_at, count(*) over ()::text as total_count
           from public.vediora_safety_reports
          where patient_id = $1 order by version desc limit 1`, [patientId],
      ),
      query<CountedAccess>(
        `select r.id, p.full_name as doctor_name, d.specialization, d.organization, r.status, r.requested_at,
                count(*) filter (where r.status = 'approved') over ()::text as approved_count,
                count(*) filter (where r.status = 'pending') over ()::text as pending_count
           from public.vediora_access_requests r
           join public.vediora_profiles p on p.id = r.doctor_id
           join public.vediora_doctor_profiles d on d.id = r.doctor_id
          where r.patient_id = $1
          order by case r.status when 'pending' then 1 when 'approved' then 2 else 3 end, r.requested_at desc
          limit 4`, [patientId],
      ),
    ]);

    const profile = profileResult.rows[0];
    if (!profile) return privateJson({ error: 'Your account profile is not ready. Please contact the project administrator.' }, 503);
    const medicines = medicineResult.rows.map(({ total_count: _total, ...medicine }) => medicine);
    const prescriptions = prescriptionResult.rows.map(({ total_count: _total, item_count, ...prescription }) => ({ ...prescription, item_count: Number(item_count) }));
    const latestReport = reportResult.rows[0] ? (({ total_count: _total, ...report }) => report)(reportResult.rows[0]) : null;
    const accessRequests = accessResult.rows.map(({ approved_count: _approved, pending_count: _pending, ...request }) => request);
    const data: PatientDashboardData = {
      profile,
      email: current.user.email || '',
      stats: {
        activeMedicines: Number(medicineResult.rows[0]?.total_count || 0),
        prescriptions: Number(prescriptionResult.rows[0]?.total_count || 0),
        reports: Number(reportResult.rows[0]?.total_count || 0),
        approvedDoctors: Number(accessResult.rows[0]?.approved_count || 0),
        pendingRequests: Number(accessResult.rows[0]?.pending_count || 0),
      },
      medicines,
      prescriptions,
      latestReport,
      accessRequests,
    };
    return privateJson(data);
  } catch (error) {
    console.error('Patient dashboard error', error instanceof Error ? error.message : 'Unknown error');
    return privateJson({ error: 'Your dashboard could not be loaded. Please try again.' }, 503);
  }
}
