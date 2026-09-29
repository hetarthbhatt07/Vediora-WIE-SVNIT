import type { PatientProfile } from '@/lib/patient-profile';

export interface DashboardMedicine {
  id: string;
  medicine_name: string;
  dosage: string | null;
  frequency: string | null;
  updated_at: string;
}

export interface DashboardPrescription {
  id: string;
  prescriber_name: string | null;
  prescribed_on: string | null;
  status: string;
  item_count: number;
  created_at: string;
}

export interface DashboardReport {
  id: string;
  version: number;
  overall_severity: string;
  summary: string;
  created_at: string;
}

export interface DashboardAccessRequest {
  id: string;
  doctor_name: string;
  specialization: string | null;
  organization: string | null;
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  requested_at: string;
}

export interface PatientDashboardData {
  profile: PatientProfile;
  email: string;
  stats: {
    activeMedicines: number;
    prescriptions: number;
    reports: number;
    approvedDoctors: number;
    pendingRequests: number;
  };
  medicines: DashboardMedicine[];
  prescriptions: DashboardPrescription[];
  latestReport: DashboardReport | null;
  accessRequests: DashboardAccessRequest[];
}
