import { PatientAccessManager } from '@/components/patient/PatientAccessManager';

export default function PatientAccessPage() {
  return <div className="space-y-6">
    <header className="rounded-2xl border border-slate-200 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Patient consent</p><h1 className="mt-2 text-2xl font-bold text-slate-900">Doctor access</h1><p className="mt-2 max-w-2xl text-sm text-slate-600">Review each doctor request. A doctor can read your current profile only while the request is approved. Revocation takes effect on their next request.</p></header>
    <PatientAccessManager />
  </div>;
}
