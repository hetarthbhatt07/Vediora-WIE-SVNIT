'use client';
import { useState } from 'react';
import { usePatientProfile } from '@/lib/use-patient-profile';
import type { PatientProfile } from '@/lib/patient-profile';
import { ProfileState } from '@/components/patient/ProfileState';
import { RecessedInput } from '@/components/ui/RecessedInput';
import { TactileButton } from '@/components/ui/TactileButton';
import { markWorkspaceUpdated } from '@/lib/workspace-sync';

function ProfileForm({ profile, saved }: { profile: PatientProfile; saved: () => Promise<void> }) {
  const [form, setForm] = useState({ full_name: profile.full_name, phone: profile.phone || '', date_of_birth: profile.date_of_birth || '', gender: profile.gender || '', blood_group: profile.blood_group || '', height_cm: profile.height_cm?.toString() || '', weight_kg: profile.weight_kg?.toString() || '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const field = (key: keyof typeof form) => ({ value: form[key], onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setForm({ ...form, [key]: e.target.value }); setMessage(''); } });
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/patient/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, height_cm: form.height_cm === '' ? null : Number(form.height_cm), weight_kg: form.weight_kg === '' ? null : Number(form.weight_kg) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your profile.');
      await saved();
      markWorkspaceUpdated('patient');
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save your profile.'); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-6">
    <p className="text-sm text-slate-500">Only enter details you want to save. Optional fields can be left blank.</p>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
    <div className="grid gap-5 sm:grid-cols-2">
      <RecessedInput label="Full name" required maxLength={120} autoComplete="name" {...field('full_name')} />
      <RecessedInput label="Phone" type="tel" autoComplete="tel" maxLength={30} {...field('phone')} />
      <RecessedInput label="Date of birth" type="date" min="1900-01-01" max={new Date().toISOString().slice(0, 10)} {...field('date_of_birth')} />
      <RecessedInput label="Gender" maxLength={40} {...field('gender')} />
      <RecessedInput label="Height (cm)" type="number" min="0.1" max="300" step="0.1" {...field('height_cm')} />
      <RecessedInput label="Weight (kg)" type="number" min="0.1" max="700" step="0.1" {...field('weight_kg')} />
      <label className="flex flex-col gap-2 text-xs font-semibold text-slate-700">Blood group<select {...field('blood_group')} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm"><option value="">Not provided</option>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(value => <option key={value}>{value}</option>)}</select></label>
    </div>
    <TactileButton type="submit" isLoading={busy}>Save profile</TactileButton>
  </form>;
}
export default function PatientProfilePage() {
  const { profile, loading, error, reload } = usePatientProfile();
  const [saved, setSaved] = useState(false);
  if (loading || error || !profile) return <ProfileState loading={loading} error={error} retry={reload} />;
  return <div className="space-y-5"><h1 className="text-2xl font-bold">My health profile</h1>{saved && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Your profile has been saved.</p>}<ProfileForm key={profile.updated_at} profile={profile} saved={async () => { await reload(); setSaved(true); }} /></div>;
}
