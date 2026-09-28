'use client';
import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { RecessedInput } from '@/components/ui/RecessedInput';
import { TactileButton } from '@/components/ui/TactileButton';
import { markWorkspaceUpdated } from '@/lib/workspace-sync';

export default function DoctorProfilePage() {
  const [form, setForm] = useState({ license_number: '', specialization: '', organization: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { fetch('/api/doctor/workspace', { cache: 'no-store' }).then(async response => {
    const body = await response.json(); if (!response.ok) throw new Error(body.error);
    setForm({ license_number: body.doctor.licenseNumber || '', specialization: body.doctor.specialization || '', organization: body.doctor.organization || '' });
  }).catch(error => setError(error.message || 'Could not load doctor profile.')).finally(() => setLoading(false)); }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try { const response = await fetch('/api/doctor/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); markWorkspaceUpdated('doctor'); setMessage('Doctor profile saved. Dashboard information is now up to date.'); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not save doctor profile.'); }
    finally { setBusy(false); }
  }
  if (loading) return <p role="status" className="p-8 text-slate-500">Loading doctor profile…</p>;
  return <div className="mx-auto max-w-2xl space-y-6"><header><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Doctor workspace</p><h1 className="mt-2 text-2xl font-bold">Professional profile</h1><p className="mt-2 text-sm text-slate-600">Patients see this information when deciding whether to approve access.</p></header><form onSubmit={save} className="space-y-5 rounded-2xl border bg-white p-6">{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}<RecessedInput label="Medical license number" value={form.license_number} onChange={event => setForm({ ...form, license_number: event.target.value })} required maxLength={80} /><RecessedInput label="Specialization" value={form.specialization} onChange={event => setForm({ ...form, specialization: event.target.value })} maxLength={120} /><RecessedInput label="Hospital or organization" value={form.organization} onChange={event => setForm({ ...form, organization: event.target.value })} maxLength={160} /><div className="flex gap-3"><TactileButton type="submit" isLoading={busy}>Save profile</TactileButton><Link href="/doctor/dashboard"><TactileButton type="button" variant="secondary">Cancel</TactileButton></Link></div></form></div>;
}
