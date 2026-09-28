'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  Activity, ArrowRight, CalendarDays, CheckCircle2, ChevronRight, ClipboardList,
  FileCheck2, HeartPulse, MessageSquareText, Pill, Plus, ShieldCheck, Sparkles,
  Stethoscope, UserRound,
} from 'lucide-react';
import type { PatientDashboardData } from '@/lib/patient-dashboard';
import { subscribeToWorkspaceUpdates } from '@/lib/workspace-sync';

function formatDate(value: string | null) {
  if (!value) return 'Date not added';
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function completion(data: PatientDashboardData) {
  const profile = data.profile;
  const values = [profile.full_name, profile.phone, profile.date_of_birth, profile.gender, profile.blood_group, profile.height_cm, profile.weight_kg];
  return Math.round((values.filter(value => value !== null && value !== '').length / values.length) * 100);
}

function DashboardSkeleton() {
  return <div role="status" aria-label="Loading dashboard" className="space-y-6 animate-pulse">
    <div className="h-56 rounded-3xl bg-slate-200" />
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map(item => <div key={item} className="h-28 rounded-2xl bg-slate-200" />)}</div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.8fr)]"><div className="h-80 rounded-3xl bg-slate-200" /><div className="h-80 rounded-3xl bg-slate-200" /></div>
    <span className="sr-only">Loading your health workspace…</span>
  </div>;
}

function StatCard({ icon, label, value, detail, accent }: { icon: ReactNode; label: string; value: number; detail: string; accent: string }) {
  return <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-sm font-medium text-slate-500">{label}</p><p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{value}</p></div>
      <span className={`grid h-11 w-11 place-items-center rounded-2xl ${accent}`}>{icon}</span>
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
  </div>;
}

function SectionCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-slate-200/80 bg-white shadow-sm ${className}`}>{children}</section>;
}

function EmptyState({ icon, title, text, href, action }: { icon: ReactNode; title: string; text: string; href: string; action: string }) {
  return <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
    <span className="grid h-11 w-11 place-items-center rounded-2xl bg-white text-blue-600 shadow-sm">{icon}</span>
    <h3 className="mt-4 font-semibold text-slate-900">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{text}</p>
    <Link href={href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">{action}<ArrowRight className="h-4 w-4" /></Link>
  </div>;
}

export default function PatientDashboard() {
  const [data, setData] = useState<PatientDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/patient/dashboard', { cache: 'no-store', signal });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load your dashboard.');
      if (!signal?.aborted) setData(payload);
    } catch (error) {
      if (!signal?.aborted) setError(error instanceof Error ? error.message : 'Unable to load your dashboard.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  useEffect(() => subscribeToWorkspaceUpdates('patient', () => void load()), [load]);
  const profileCompletion = useMemo(() => data ? completion(data) : 0, [data]);

  if (loading) return <DashboardSkeleton />;
  if (error || !data) return <div className="rounded-3xl border border-red-200 bg-white p-8 shadow-sm"><p role="alert" className="font-medium text-red-700">{error || 'Your dashboard is unavailable.'}</p><button onClick={() => void load()} className="mt-5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Try again</button></div>;

  const displayName = data.profile.full_name.trim() || 'Patient';
  const reportSeverity = data.latestReport?.overall_severity || 'Not checked';
  const severityStyle = reportSeverity.toLowerCase() === 'major'
    ? 'border-red-200 bg-red-50 text-red-700'
    : reportSeverity.toLowerCase() === 'moderate'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : 'border-emerald-200 bg-emerald-50 text-emerald-700';

  return <div className="space-y-6 pb-10">
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-600 p-6 text-white shadow-[0_20px_55px_-30px_rgba(37,99,235,0.8)] sm:p-8 lg:p-10">
      <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
      <div className="absolute -bottom-28 right-40 h-64 w-64 rounded-full bg-cyan-300/20 blur-3xl" />
      <div className="relative grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur-sm"><Sparkles className="h-3.5 w-3.5" />Your health workspace</div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight sm:text-4xl">Welcome, {displayName}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-50 sm:text-base">Keep medicines, prescriptions, evidence reports, and doctor access together in one clear place.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/patient/chat" className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-blue-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><MessageSquareText className="h-4 w-4" />Ask Vediora</Link>
            <Link href="/patient/medications" className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"><Plus className="h-4 w-4" />Add medicine</Link>
          </div>
        </div>
        <div className="min-w-56 rounded-2xl border border-white/20 bg-slate-950/15 p-4 backdrop-blur-sm">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-300/20 text-emerald-100"><CheckCircle2 className="h-5 w-5" /></span><div><p className="text-xs text-blue-100">Workspace status</p><p className="font-semibold">Connected and ready</p></div></div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-emerald-300" style={{ width: `${profileCompletion}%` }} /></div>
          <p className="mt-2 text-xs text-blue-100">Health profile {profileCompletion}% complete</p>
        </div>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard icon={<Pill className="h-5 w-5" />} label="Active medicines" value={data.stats.activeMedicines} detail="Included in future safety comparisons" accent="bg-blue-50 text-blue-600" />
      <StatCard icon={<ClipboardList className="h-5 w-5" />} label="Prescriptions" value={data.stats.prescriptions} detail="Confirmed records in your workspace" accent="bg-violet-50 text-violet-600" />
      <StatCard icon={<FileCheck2 className="h-5 w-5" />} label="Evidence reports" value={data.stats.reports} detail="Versioned safety snapshots" accent="bg-cyan-50 text-cyan-700" />
      <StatCard icon={<Stethoscope className="h-5 w-5" />} label="Approved doctors" value={data.stats.approvedDoctors} detail={data.stats.pendingRequests ? `${data.stats.pendingRequests} request${data.stats.pendingRequests === 1 ? '' : 's'} awaiting you` : 'No requests waiting'} accent="bg-emerald-50 text-emerald-600" />
    </div>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(330px,0.75fr)]">
      <div className="space-y-6">
        <SectionCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-blue-600">Medication snapshot</p><h2 className="mt-1 text-xl font-bold text-slate-950">Your current medicines</h2></div><Link href="/patient/medications" className="inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">Manage all<ChevronRight className="h-4 w-4" /></Link></div>
          {data.medicines.length ? <div className="mt-5 grid gap-3 sm:grid-cols-2">{data.medicines.map((medicine, index) => <div key={medicine.id} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-blue-200 hover:bg-blue-50/40">
            <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-blue-600 shadow-sm"><Pill className="h-5 w-5" /></span><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{medicine.medicine_name}</p><p className="mt-1 text-sm text-slate-500">{[medicine.dosage, medicine.frequency].filter(Boolean).join(' · ') || 'Dose details not added'}</p><p className="mt-2 text-xs text-slate-400">{index === 0 ? 'Most recently updated' : `Updated ${formatDate(medicine.updated_at)}`}</p></div></div>
          </div>)}</div> : <div className="mt-5"><EmptyState icon={<Pill className="h-5 w-5" />} title="Build your medicine list" text="Add current medicines so Vediora can include them in interaction checks." href="/patient/medications" action="Add your first medicine" /></div>}
        </SectionCard>

        <SectionCard className="overflow-hidden">
          <div className="border-b border-slate-100 p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wider text-cyan-700">Latest safety evidence</p><h2 className="mt-1 text-xl font-bold text-slate-950">Interaction report</h2></div><span className={`rounded-full border px-3 py-1 text-xs font-bold ${severityStyle}`}>{reportSeverity}</span></div></div>
          {data.latestReport ? <div className="p-5 sm:p-6"><div className="flex gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700"><Activity className="h-6 w-6" /></span><div><p className="font-semibold text-slate-900">Report version {data.latestReport.version}</p><p className="mt-2 text-sm leading-6 text-slate-600">{data.latestReport.summary}</p><p className="mt-3 text-xs text-slate-400">Generated {formatDate(data.latestReport.created_at)}</p></div></div><Link href="/patient/reports" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">View evidence report<ArrowRight className="h-4 w-4" /></Link></div> : <div className="p-5 sm:p-6"><EmptyState icon={<FileCheck2 className="h-5 w-5" />} title="No report generated yet" text="When you have at least two active medicines, generate a versioned interaction report." href="/patient/reports" action="Open evidence reports" /></div>}
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-violet-600">Recent records</p><h2 className="mt-1 text-xl font-bold text-slate-950">Prescriptions</h2></div><Link href="/patient/prescriptions" className="text-sm font-semibold text-blue-600 hover:text-blue-700">View all</Link></div>
          {data.prescriptions.length ? <div className="mt-5 divide-y divide-slate-100">{data.prescriptions.map(prescription => <Link href="/patient/prescriptions" key={prescription.id} className="group flex items-center gap-4 py-4 first:pt-0 last:pb-0"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600"><ClipboardList className="h-5 w-5" /></span><div className="min-w-0 flex-1"><p className="truncate font-semibold text-slate-900">{prescription.prescriber_name || 'Confirmed prescription'}</p><p className="mt-1 text-sm text-slate-500">{prescription.item_count} medicine{prescription.item_count === 1 ? '' : 's'} · {formatDate(prescription.prescribed_on || prescription.created_at)}</p></div><ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600" /></Link>)}</div> : <p className="mt-5 rounded-2xl bg-slate-50 p-5 text-sm leading-6 text-slate-500">No confirmed prescriptions yet. Add a reviewed prescription to keep its medicines and prescriber details together.</p>}
        </SectionCard>
      </div>

      <div className="space-y-6 xl:sticky xl:top-24">
        <SectionCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Health profile</p><h2 className="mt-1 text-lg font-bold text-slate-950">Profile readiness</h2></div><div className="grid h-14 w-14 place-items-center rounded-full bg-blue-50 text-sm font-bold text-blue-700 ring-4 ring-blue-100">{profileCompletion}%</div></div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 transition-all" style={{ width: `${profileCompletion}%` }} /></div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Blood group</p><p className="mt-1 font-semibold text-slate-900">{data.profile.blood_group || 'Not added'}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Date of birth</p><p className="mt-1 font-semibold text-slate-900">{formatDate(data.profile.date_of_birth)}</p></div></div>
          <Link href="/patient/profile" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><UserRound className="h-4 w-4" />Edit health profile</Link>
        </SectionCard>

        <SectionCard className="p-5 sm:p-6">
          <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><ShieldCheck className="h-5 w-5" /></span><div><p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Doctor access</p><h2 className="font-bold text-slate-950">You stay in control</h2></div></div>
          {data.accessRequests.length ? <div className="mt-5 space-y-3">{data.accessRequests.slice(0, 3).map(request => <div key={request.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><Stethoscope className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{request.doctor_name}</p><p className="truncate text-xs text-slate-500">{request.specialization || request.organization || 'Doctor'}</p></div><span className={`rounded-full px-2 py-1 text-[11px] font-bold capitalize ${request.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : request.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{request.status}</span></div>)}</div> : <p className="mt-4 text-sm leading-6 text-slate-500">No doctor access requests yet. A doctor must request access and wait for your approval.</p>}
          <Link href="/patient/access" className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-600 hover:text-blue-700">Manage access<ChevronRight className="h-4 w-4" /></Link>
        </SectionCard>

        <SectionCard className="overflow-hidden bg-gradient-to-br from-slate-950 to-blue-950 p-5 text-white sm:p-6">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-cyan-200"><HeartPulse className="h-5 w-5" /></span><h2 className="mt-4 text-lg font-bold">Need a medicine answer?</h2><p className="mt-2 text-sm leading-6 text-slate-300">Ask about a medicine, side effects, or a combination. Vediora checks saved medicines and imported interaction evidence.</p><Link href="/patient/chat" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-cyan-200 hover:text-white">Start a conversation<ArrowRight className="h-4 w-4" /></Link>
        </SectionCard>

        <p className="flex items-start gap-2 px-2 text-xs leading-5 text-slate-500"><CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />Your workspace reflects current saved records. Confirm treatment decisions with a doctor or pharmacist.</p>
      </div>
    </div>
  </div>;
}
