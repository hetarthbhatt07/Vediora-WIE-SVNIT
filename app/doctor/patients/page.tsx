'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Search, ShieldCheck, Users } from 'lucide-react';
import { RecessedInput } from '@/components/ui/RecessedInput';
import { TactileButton } from '@/components/ui/TactileButton';

interface Patient {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  blood_group: string | null;
  updated_at: string;
}

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { fetch('/api/doctor/workspace', { cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setPatients(body.patients || []); }).catch(error => setError(error.message || 'Could not load patients.')).finally(() => setLoading(false)); }, []);
  const filtered = useMemo(() => patients.filter(patient => `${patient.full_name} ${patient.email}`.toLowerCase().includes(query.toLowerCase())), [patients, query]);
  if (loading) return <p role="status" className="p-8 text-slate-500">Loading approved patients…</p>;
  return <div className="space-y-6"><header className="rounded-2xl border bg-white p-6"><div className="flex items-center gap-3"><Users className="h-6 w-6 text-teal-600" /><div><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Consent-based directory</p><h1 className="text-2xl font-bold">Approved patients</h1></div></div><p className="mt-3 text-sm text-slate-600">This list is generated from currently approved access requests. Revoked patients disappear on refresh.</p></header>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}<RecessedInput label="Search approved patients" value={query} onChange={event => setQuery(event.target.value)} leftIcon={<Search className="h-4 w-4" />} placeholder="Name or email" />
    {filtered.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><ShieldCheck className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold">No approved patients found</p><p className="mt-1 text-sm text-slate-500">Send an access request from the doctor dashboard and wait for patient approval.</p><Link href="/doctor/dashboard" className="mt-4 inline-block"><TactileButton>Open dashboard</TactileButton></Link></div> : <div className="grid gap-4 md:grid-cols-2">{filtered.map(patient => <article key={patient.id} className="rounded-xl border bg-white p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-bold text-slate-900">{patient.full_name}</h2><p className="text-sm text-slate-500">{patient.email}</p></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Approved</span></div><dl className="mt-4 grid grid-cols-2 gap-2 text-sm"><dt className="text-slate-500">Blood group</dt><dd>{patient.blood_group || 'Not provided'}</dd><dt className="text-slate-500">Date of birth</dt><dd>{patient.date_of_birth || 'Not provided'}</dd></dl><Link href={`/doctor/patients/${patient.id}`} className="mt-5 inline-block"><TactileButton size="sm" rightIcon={<ArrowRight className="h-4 w-4" />}>Open current profile</TactileButton></Link></article>)}</div>}
  </div>;
}
