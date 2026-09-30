'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { RecessedInput } from '@/components/ui/RecessedInput';
import { TactileButton } from '@/components/ui/TactileButton';
import { markWorkspaceUpdated } from '@/lib/workspace-sync';

const emptyForm = {
  full_name: '', phone: '', date_of_birth: '', gender: '', blood_group: '', height_cm: '', weight_kg: '',
  license_number: '', specialization: '', organization: '',
};

export default function DoctorProfilePage() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setForm(current => ({ ...current, [key]: event.target.value }));
      setMessage('');
    },
  });

  useEffect(() => {
    fetch('/api/doctor/workspace', { cache: 'no-store' }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setForm({
        full_name: body.doctor.fullName || '',
        phone: body.doctor.phone || '',
        date_of_birth: body.doctor.dateOfBirth || '',
        gender: body.doctor.gender || '',
        blood_group: body.doctor.bloodGroup || '',
        height_cm: body.doctor.heightCm?.toString() || '',
        weight_kg: body.doctor.weightKg?.toString() || '',
        license_number: body.doctor.licenseNumber || '',
        specialization: body.doctor.specialization || '',
        organization: body.doctor.organization || '',
      });
    }).catch(error => setError(error.message || 'Could not load doctor profile.')).finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/doctor/profile', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          height_cm: form.height_cm === '' ? null : Number(form.height_cm),
          weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg),
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      markWorkspaceUpdated('doctor');
      setMessage('Doctor profile saved. Your dashboard and patient access requests now use the updated details.');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save doctor profile.'); }
    finally { setBusy(false); }
  }

  if (loading) return <p role="status" className="p-8 text-slate-500">Loading doctor profile...</p>;

  return <div className="mx-auto max-w-4xl space-y-6">
    <header><p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Doctor workspace</p><h1 className="mt-2 text-2xl font-bold">Professional profile</h1><p className="mt-2 text-sm text-slate-600">Keep your personal and professional details current. License verification is not enabled in this demo, so the license number is shown as self-reported.</p></header>
    <form onSubmit={save} className="space-y-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}

      <section><h2 className="text-lg font-bold text-slate-950">Personal details</h2><p className="mt-1 text-sm text-slate-500">These details help identify your account and complete your workspace profile.</p><div className="mt-5 grid gap-5 sm:grid-cols-2">
        <RecessedInput label="Full name" required maxLength={120} autoComplete="name" {...field('full_name')} />
        <RecessedInput label="Phone" type="tel" autoComplete="tel" maxLength={30} {...field('phone')} />
        <RecessedInput label="Date of birth" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} {...field('date_of_birth')} />
        <RecessedInput label="Gender" maxLength={40} {...field('gender')} />
        <RecessedInput label="Height (cm)" type="number" min="0.1" max="300" step="0.1" {...field('height_cm')} />
        <RecessedInput label="Weight (kg)" type="number" min="0.1" max="700" step="0.1" {...field('weight_kg')} />
        <label className="flex flex-col gap-2 text-xs font-semibold text-slate-700">Blood group<select {...field('blood_group')} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-normal"><option value="">Not provided</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(value => <option key={value}>{value}</option>)}</select></label>
      </div></section>

      <section className="border-t border-slate-100 pt-7"><h2 className="text-lg font-bold text-slate-950">Professional details</h2><p className="mt-1 text-sm text-slate-500">Patients see these details when deciding whether to approve access.</p><div className="mt-5 grid gap-5 sm:grid-cols-2">
        <RecessedInput label="Medical license number (self-reported)" value={form.license_number} onChange={event => setForm({ ...form, license_number: event.target.value })} required maxLength={80} />
        <RecessedInput label="Specialization" value={form.specialization} onChange={event => setForm({ ...form, specialization: event.target.value })} maxLength={120} />
        <div className="sm:col-span-2"><RecessedInput label="Hospital or organization" value={form.organization} onChange={event => setForm({ ...form, organization: event.target.value })} maxLength={160} /></div>
      </div><p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">Demo status: Vediora stores the entered license number but does not currently verify it against a medical council registry.</p></section>

      <div className="flex flex-wrap gap-3"><TactileButton type="submit" isLoading={busy}>Save profile</TactileButton><Link href="/doctor/dashboard"><TactileButton type="button" variant="secondary">Cancel</TactileButton></Link></div>
    </form>
  </div>;
}
