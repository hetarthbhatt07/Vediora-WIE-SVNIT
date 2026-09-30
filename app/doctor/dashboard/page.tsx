'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowRight, CheckCircle2, ChevronRight, ClipboardCheck, Clock3, FileCheck2,
  MessageSquareText, Send, ShieldCheck, Sparkles, Stethoscope, UserCheck, Users,
} from 'lucide-react';
import { RecessedInput } from '@/components/ui/RecessedInput';
import { TactileButton } from '@/components/ui/TactileButton';
import { markWorkspaceUpdated, subscribeToWorkspaceUpdates } from '@/lib/workspace-sync';

interface Workspace {
  doctor: { fullName: string; email: string | null; phone: string | null; dateOfBirth: string | null; gender: string | null; bloodGroup: string | null; heightCm: number | null; weightKg: number | null; licenseNumber: string; specialization: string | null; organization: string | null; verificationStatus: string };
  requests: Array<{ id: string; patient_id: string; patient_name: string; patient_email: string; status: string; request_message: string | null; requested_at: string }>;
  patients: Array<{ id: string; full_name: string; email: string; blood_group: string | null; updated_at: string }>;
  summary: { approved_patients: number; pending_requests: number; active_medicines: number; accessible_reports: number };
  recentReports: Array<{ id: string; patient_id: string; patient_name: string; version: number; overall_severity: string; summary: string; generator_role: string | null; created_at: string }>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function StatCard({ icon, label, value, detail, accent }: { icon: ReactNode; label: string; value: number; detail: string; accent: string }) {
  return <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-200 hover:shadow-md">
    <div className="flex items-start justify-between gap-4"><div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p></div><span className={`grid h-11 w-11 place-items-center rounded-2xl ${accent}`}>{icon}</span></div>
    <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
  </div>;
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200/80 bg-white shadow-sm ${className}`}>{children}</section>;
}

function DashboardSkeleton() {
  return <div role="status" aria-label="Loading doctor dashboard" className="space-y-6 animate-pulse"><div className="h-56 rounded-3xl bg-slate-200" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="h-28 rounded-2xl bg-slate-200" />)}</div><div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.75fr)]"><div className="h-96 rounded-3xl bg-slate-200" /><div className="h-96 rounded-3xl bg-slate-200" /></div><span className="sr-only">Loading your clinical workspace…</span></div>;
}

export default function DoctorDashboard() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [email, setEmail] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/doctor/workspace', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load doctor workspace.');
      setWorkspace(body);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load doctor workspace.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => subscribeToWorkspaceUpdates('doctor', () => void load()), [load]);

  async function requestAccess(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/doctor/access-requests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_email: email, message: requestMessage }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not send access request.');
      setEmail(''); setRequestMessage('');
      setMessage('Access request sent. The patient must approve it before their profile becomes available.');
      markWorkspaceUpdated('doctor');
      markWorkspaceUpdated('patient');
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not send access request.'); }
    finally { setBusy(false); }
  }

  const profileCompletion = useMemo(() => {
    if (!workspace) return 0;
    const values = [workspace.doctor.fullName, workspace.doctor.phone, workspace.doctor.dateOfBirth, workspace.doctor.gender, workspace.doctor.bloodGroup, workspace.doctor.heightCm, workspace.doctor.weightKg, workspace.doctor.licenseNumber, workspace.doctor.specialization, workspace.doctor.organization];
    return Math.round((values.filter(Boolean).length / values.length) * 100);
  }, [workspace]);

  if (loading && !workspace) return <DashboardSkeleton />;
  if (!workspace) return <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm"><p role="alert" className="font-medium text-red-700">{error || 'Doctor workspace is unavailable.'}</p><TactileButton className="mt-5" variant="secondary" onClick={load}>Try again</TactileButton></div>;

  const displayName = workspace.doctor.fullName.trim() || 'Doctor';
  return <div className="space-y-6 pb-10">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-blue-700 to-blue-600 p-6 text-white shadow-[0_20px_55px_-30px_rgba(13,148,136,0.75)] sm:p-8 lg:p-10">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" /><div className="absolute -bottom-28 right-40 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="relative grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div><div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"><Sparkles className="h-3.5 w-3.5" />Your clinical workspace</div><h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Welcome, {displayName}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">Review approved patient medicines, create evidence-linked reports, and manage consent requests from one workspace.</p><div className="mt-6 flex flex-wrap gap-3"><Link href="/doctor/analysis" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-teal-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><Activity className="h-4 w-4" />Start clinical review</Link><Link href="/doctor/chat" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"><MessageSquareText className="h-4 w-4" />Ask Vediora</Link></div></div>
        <div className="min-w-60 rounded-2xl border border-white/20 bg-slate-950/15 p-4 backdrop-blur-sm"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/20 text-emerald-100"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-xs text-blue-100">Workspace status</p><p className="font-semibold">Connected and consent-aware</p></div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${profileCompletion}%` }} /></div><p className="mt-2 text-xs text-blue-100">Professional profile {profileCompletion}% complete</p></div>
      </div>
    </section>

    {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}{message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">{message}</p> : null}

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={<Users className="h-5 w-5" />} label="Approved patients" value={workspace.summary.approved_patients} detail="Profiles available under active consent" accent="bg-emerald-50 text-emerald-600" />
      <StatCard icon={<Clock3 className="h-5 w-5" />} label="Pending requests" value={workspace.summary.pending_requests} detail="Waiting for a patient decision" accent="bg-amber-50 text-amber-600" />
      <StatCard icon={<ClipboardCheck className="h-5 w-5" />} label="Active medicines" value={workspace.summary.active_medicines} detail="Across currently approved patients" accent="bg-blue-50 text-blue-600" />
      <StatCard icon={<FileCheck2 className="h-5 w-5" />} label="Accessible reports" value={workspace.summary.accessible_reports} detail="Visible while patient consent remains active" accent="bg-cyan-50 text-cyan-700" />
    </div>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.75fr)]">
      <div className="space-y-6">
        <SectionCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Consent-based directory</p><h2 className="mt-1 text-xl font-bold text-slate-950">Approved patients</h2></div><Link href="/doctor/patients" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">View all<ChevronRight className="h-4 w-4" /></Link></div>
          {workspace.patients.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{workspace.patients.slice(0, 4).map(patient => <Link key={patient.id} href={`/doctor/patients/${patient.id}`} className="group rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-teal-200 hover:bg-teal-50/40"><div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white font-bold text-teal-700 shadow-sm">{patient.full_name.trim().charAt(0).toUpperCase() || 'P'}</span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{patient.full_name}</p><p className="truncate text-sm text-slate-500">{patient.email}</p></div><ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-teal-600" /></div><div className="mt-3 flex items-center justify-between text-xs"><span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">Approved</span><span className="text-slate-400">Updated {formatDate(patient.updated_at)}</span></div></Link>)}</div> : <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-10 text-center"><UserCheck className="mx-auto h-8 w-8 text-slate-400" /><h3 className="mt-3 font-semibold text-slate-900">No approved patients yet</h3><p className="mt-1 text-sm text-slate-500">Send a request below and wait for the patient to approve it.</p></div>}
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-teal-50 text-teal-600"><Send className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Patient consent</p><h2 className="text-xl font-bold text-slate-950">Request patient access</h2></div></div><p className="mt-3 text-sm leading-6 text-slate-500">The patient must approve your request before any profile, medicine, or report becomes available.</p>
          <form onSubmit={requestAccess} className="mt-5 space-y-4"><RecessedInput label="Patient account email" type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={320} placeholder="patient@example.com" /><label className="block text-xs font-semibold text-slate-700">Reason for access<textarea aria-label="Reason for access" value={requestMessage} onChange={event => setRequestMessage(event.target.value)} maxLength={500} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-normal focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-100" placeholder="Explain why you are requesting access." /></label><TactileButton type="submit" isLoading={busy} leftIcon={<Send className="h-4 w-4" />}>Send access request</TactileButton></form>
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Recent activity</p><h2 className="mt-1 text-xl font-bold text-slate-950">Evidence reports</h2></div><Link href="/doctor/reports" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View all</Link></div>
          {workspace.recentReports.length ? <div className="mt-5 divide-y divide-slate-100">{workspace.recentReports.map(report => <Link href="/doctor/reports" key={report.id} className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600"><FileCheck2 className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{report.patient_name} · Report {report.version}</p><p className="mt-1 truncate text-sm text-slate-500">{report.summary}</p><p className="mt-1 text-xs text-slate-400">{formatDate(report.created_at)} · {report.generator_role === 'doctor' ? 'Clinician generated' : 'Patient generated'}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${report.overall_severity.toLowerCase() === 'major' ? 'bg-red-50 text-red-700' : report.overall_severity.toLowerCase() === 'moderate' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{report.overall_severity}</span></Link>)}</div> : <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-500">No accessible reports yet. Run a clinical review for an approved patient to create one.</p>}
        </SectionCard>
      </div>

      <div className="space-y-6 xl:sticky xl:top-24">
        <SectionCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-teal-700">Doctor profile</p><h2 className="mt-1 text-lg font-bold text-slate-950">Profile readiness</h2></div><div className="grid h-14 w-14 place-items-center rounded-full bg-teal-50 text-sm font-bold text-teal-700 ring-4 ring-teal-100">{profileCompletion}%</div></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-blue-500 transition-all" style={{ width: `${profileCompletion}%` }} /></div><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1"><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Full name</dt><dd className="mt-1 font-semibold text-slate-900">{workspace.doctor.fullName}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Contact</dt><dd className="mt-1 font-semibold text-slate-900">{workspace.doctor.phone || 'Not added'}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Personal details</dt><dd className="mt-1 font-semibold text-slate-900">{workspace.doctor.dateOfBirth ? formatDate(workspace.doctor.dateOfBirth) : 'Birth date not added'}{workspace.doctor.bloodGroup ? ` · ${workspace.doctor.bloodGroup}` : ''}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Specialization</dt><dd className="mt-1 font-semibold text-slate-900">{workspace.doctor.specialization || 'Not added'}</dd></div><div className="rounded-xl bg-slate-50 p-3"><dt className="text-xs text-slate-500">Organization</dt><dd className="mt-1 font-semibold text-slate-900">{workspace.doctor.organization || 'Not added'}</dd></div><div className="rounded-xl bg-amber-50 p-3"><dt className="text-xs text-amber-700">License number (self-reported)</dt><dd className="mt-1 truncate font-semibold text-slate-900">{workspace.doctor.licenseNumber}</dd><p className="mt-1 text-[11px] leading-4 text-amber-700">Registry verification is not enabled in this demo.</p></div></dl><Link href="/doctor/profile" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"><Stethoscope className="h-4 w-4" />Edit doctor profile</Link>
        </SectionCard>

        <SectionCard className="p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Quick actions</p><div className="mt-4 space-y-2"><Link href="/doctor/analysis" className="flex items-center gap-3 rounded-xl p-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"><Activity className="h-5 w-5 text-blue-600" /><span className="flex-1">Clinical medicine review</span><ChevronRight className="h-4 w-4" /></Link><Link href="/doctor/reports" className="flex items-center gap-3 rounded-xl p-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"><FileCheck2 className="h-5 w-5 text-cyan-600" /><span className="flex-1">Evidence-linked reports</span><ChevronRight className="h-4 w-4" /></Link><Link href="/doctor/chat" className="flex items-center gap-3 rounded-xl p-3 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"><MessageSquareText className="h-5 w-5 text-teal-600" /><span className="flex-1">Medicine safety chat</span><ChevronRight className="h-4 w-4" /></Link></div></SectionCard>

        <SectionCard className="overflow-hidden bg-gradient-to-br from-slate-950 to-teal-950 p-5 text-white sm:p-6"><span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-emerald-200"><ShieldCheck className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-bold">Consent stays active</h2><p className="mt-2 text-sm leading-6 text-slate-300">Patient data is available only while approval remains active. A revoked patient disappears from clinical views on the next refresh.</p><Link href="/doctor/patients" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-200 hover:text-white">Open approved patients<ArrowRight className="h-4 w-4" /></Link></SectionCard>

        <SectionCard className="p-5 sm:p-6"><div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Request history</p><h2 className="mt-1 font-bold text-slate-950">Latest requests</h2></div><span className="text-sm font-bold text-slate-400">{workspace.requests.length}</span></div><div className="mt-4 space-y-3">{workspace.requests.length ? workspace.requests.slice(0, 4).map(item => <div key={item.id} className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><UserCheck className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.patient_name}</p><p className="text-xs text-slate-400">{formatDate(item.requested_at)}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-bold capitalize ${item.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : item.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span></div>) : <p className="text-sm text-slate-500">No access requests sent yet.</p>}</div></SectionCard>
      </div>
    </div>
  </div>;
}
