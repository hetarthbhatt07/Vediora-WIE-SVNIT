'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, FileText, HeartPulse, Mail, Pill, ShieldCheck, User } from 'lucide-react';
import { BentoCard } from '@/components/ui/BentoCard';
import { TactileButton } from '@/components/ui/TactileButton';

interface Patient {
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

interface Medicine { id: string; medicine_name: string; brand_name: string | null; rxcui: string | null; dosage: string | null; frequency: string | null; notes: string | null; started_at: string | null; }
interface Prescription { id: string; prescriber_name: string | null; prescribed_on: string | null; created_at: string; items: Array<{ medicine_name: string; dosage: string | null; frequency: string | null }>; }
interface Report { id: string; version: number; overall_severity: string; summary: string; generator_role: string | null; created_at: string; }

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => { fetch(`/api/doctor/patients/${encodeURIComponent(id)}`, { cache: 'no-store' }).then(async response => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setPatient(body.patient); setMedicines(body.medicines || []); setPrescriptions(body.prescriptions || []); setReports(body.reports || []); }).catch(error => setError(error.message || 'Could not load patient profile.')).finally(() => setLoading(false)); }, [id]);
  if (loading) return <p role="status" className="p-8 text-slate-500">Loading the current patient profile…</p>;
  if (!patient) return <div className="rounded-xl border border-red-200 bg-white p-6"><p role="alert" className="text-red-700">{error || 'Patient access is unavailable.'}</p><Link href="/doctor/patients" className="mt-4 inline-block"><TactileButton variant="secondary">Back to approved patients</TactileButton></Link></div>;
  return <div className="space-y-6"><header className="rounded-2xl border bg-white p-6"><Link href="/doctor/patients" className="mb-4 inline-flex items-center gap-2 text-sm text-blue-600"><ArrowLeft className="h-4 w-4" />Approved patients</Link><div className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Current patient profile</p><h1 className="mt-2 text-2xl font-bold">{patient.full_name}</h1><p className="mt-2 text-sm text-slate-500">Loaded from Supabase after checking active patient consent.</p></div><span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><ShieldCheck className="h-4 w-4" />Access approved</span></div></header>
    <div className="grid gap-5 md:grid-cols-2"><BentoCard title="Identity and contact" icon={<User className="h-5 w-5" />}><dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-slate-500">Email</dt><dd className="break-all">{patient.email}</dd><dt className="text-slate-500">Phone</dt><dd>{patient.phone || 'Not provided'}</dd><dt className="text-slate-500">Date of birth</dt><dd>{patient.date_of_birth || 'Not provided'}</dd><dt className="text-slate-500">Gender</dt><dd>{patient.gender || 'Not provided'}</dd></dl></BentoCard><BentoCard title="Recorded measurements" icon={<HeartPulse className="h-5 w-5" />}><dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-slate-500">Blood group</dt><dd>{patient.blood_group || 'Not provided'}</dd><dt className="text-slate-500">Height</dt><dd>{patient.height_cm == null ? 'Not provided' : `${patient.height_cm} cm`}</dd><dt className="text-slate-500">Weight</dt><dd>{patient.weight_kg == null ? 'Not provided' : `${patient.weight_kg} kg`}</dd><dt className="text-slate-500">Last updated</dt><dd>{new Date(patient.updated_at).toLocaleString()}</dd></dl></BentoCard></div>
    <div className="grid gap-5 md:grid-cols-2"><BentoCard title="Active medicines" icon={<Pill className="h-5 w-5" />}>{medicines.length === 0 ? <p className="text-sm text-slate-500">The patient has not saved any active medicines.</p> : <div className="divide-y divide-slate-100">{medicines.map(item => <div key={item.id} className="py-3"><p className="font-semibold text-slate-900">{item.medicine_name}{item.brand_name ? ` (${item.brand_name})` : ''}</p><p className="mt-1 text-xs text-slate-500">{item.dosage || 'Dose not provided'} · {item.frequency || 'Frequency not provided'} · RxCUI {item.rxcui || 'not recorded'}</p>{item.notes && <p className="mt-1 text-sm text-slate-600">{item.notes}</p>}</div>)}</div>}</BentoCard><BentoCard title="Confirmed prescriptions" icon={<FileText className="h-5 w-5" />}>{prescriptions.length===0?<p className="text-sm text-slate-500">No confirmed prescriptions are saved.</p>:<div className="divide-y divide-slate-100">{prescriptions.slice(0,5).map(item=><div key={item.id} className="py-3"><p className="font-semibold">{item.prescriber_name||'Prescription record'}</p><p className="mt-1 text-xs text-slate-500">{item.prescribed_on||new Date(item.created_at).toLocaleDateString()} · {item.items.map(medicine=>medicine.medicine_name).join(', ')}</p></div>)}</div>}</BentoCard></div>
    <BentoCard title="Evidence report history" icon={<ShieldCheck className="h-5 w-5" />}>{reports.length===0?<p className="text-sm text-slate-500">No evidence reports have been generated for this patient.</p>:<div className="divide-y divide-slate-100">{reports.slice(0,5).map(report=><div key={report.id} className="flex flex-wrap items-start justify-between gap-3 py-3"><div><p className="font-semibold">Version {report.version} · {report.overall_severity}</p><p className="mt-1 max-w-2xl text-xs text-slate-500">{report.summary}</p></div><span className="text-xs text-slate-400">{new Date(report.created_at).toLocaleDateString()}</span></div>)}</div>}<div className="mt-4 flex gap-3"><Link href={`/doctor/analysis?patient=${patient.id}`}><TactileButton size="sm">Run review</TactileButton></Link><Link href="/doctor/reports"><TactileButton size="sm" variant="secondary">Open all reports</TactileButton></Link></div></BentoCard>
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900"><Mail className="mr-2 inline h-4 w-4" />Profile edits made by the patient are read from the same database and appear the next time this page loads. If the patient revokes access, this endpoint returns no profile.</div>
  </div>;
}
