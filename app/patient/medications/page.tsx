'use client';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Pill, Plus, Save, XCircle } from 'lucide-react';
import { RecessedInput } from '@/components/ui/RecessedInput';
import { TactileButton } from '@/components/ui/TactileButton';
import { markWorkspaceUpdated } from '@/lib/workspace-sync';

interface Medicine {
  id: string;
  medicine_name: string;
  generic_name: string | null;
  brand_name: string | null;
  rxcui: string | null;
  dosage: string | null;
  frequency: string | null;
  notes: string | null;
  status: 'active' | 'discontinued';
  started_at: string | null;
  ended_at: string | null;
}

const blank = { medicine_name: '', dosage: '', frequency: '', notes: '', started_at: '' };

export default function PatientMedicationsPage() {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState('');
  const [edit, setEdit] = useState({ dosage: '', frequency: '', notes: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const response = await fetch('/api/patient/medicines', { cache: 'no-store' }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setMedicines(body.medicines || []); } catch (error) { setError(error instanceof Error ? error.message : 'Could not load medicines.'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  async function add(event: FormEvent) { event.preventDefault(); setBusy('new'); setError(''); setMessage(''); try { const response = await fetch('/api/patient/medicines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setForm(blank); setMessage('Medicine added to your active list.'); markWorkspaceUpdated('patient'); await load(); } catch (error) { setError(error instanceof Error ? error.message : 'Could not add medicine.'); } finally { setBusy(''); } }
  async function update(id: string, patch: Record<string, unknown>, success: string) { setBusy(id); setError(''); setMessage(''); try { const response = await fetch(`/api/patient/medicines/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setEditing(''); setMessage(success); markWorkspaceUpdated('patient'); await load(); } catch (error) { setError(error instanceof Error ? error.message : 'Could not update medicine.'); } finally { setBusy(''); } }
  function startEdit(item: Medicine) { setEditing(item.id); setEdit({ dosage: item.dosage || '', frequency: item.frequency || '', notes: item.notes || '' }); }
  return <div className="space-y-6"><header className="rounded-2xl border bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Patient workspace</p><h1 className="mt-2 text-2xl font-bold">My medicines</h1><p className="mt-2 text-sm text-slate-600">Maintain your current medicine list using names from Vediora’s imported database. Discontinued records remain in your history.</p></header>{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <form onSubmit={add} className="space-y-4 rounded-2xl border bg-white p-6"><div className="flex items-center gap-2"><Plus className="h-5 w-5 text-blue-600" /><h2 className="font-bold">Add an active medicine</h2></div><div className="grid gap-4 md:grid-cols-2"><RecessedInput label="Exact medicine name" value={form.medicine_name} onChange={event => setForm({ ...form, medicine_name: event.target.value })} required maxLength={200} placeholder="For example: aspirin or warfarin" /><RecessedInput label="Dosage" value={form.dosage} onChange={event => setForm({ ...form, dosage: event.target.value })} maxLength={120} placeholder="For example: 5 mg" /><RecessedInput label="Frequency" value={form.frequency} onChange={event => setForm({ ...form, frequency: event.target.value })} maxLength={120} placeholder="For example: once daily" /><RecessedInput label="Start date" type="date" value={form.started_at} onChange={event => setForm({ ...form, started_at: event.target.value })} /></div><label className="block text-xs font-semibold text-slate-700">Notes<textarea aria-label="Medicine notes" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} maxLength={500} rows={3} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-normal focus:border-blue-500 focus:outline-none" /></label><TactileButton type="submit" isLoading={busy === 'new'} leftIcon={<Plus className="h-4 w-4" />}>Add medicine</TactileButton></form>
    <section className="space-y-3"><h2 className="text-lg font-bold">Medicine history</h2>{loading ? <p role="status" className="text-sm text-slate-500">Loading medicines…</p> : medicines.length === 0 ? <div className="rounded-xl border border-dashed p-8 text-center"><Pill className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold">No medicines saved yet</p></div> : medicines.map(item => <article key={item.id} className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold text-slate-900">{item.medicine_name}{item.brand_name ? ` (${item.brand_name})` : ''}</h3><p className="mt-1 text-xs text-slate-500">RxCUI: {item.rxcui || 'not recorded'}{item.started_at ? ` · Started ${item.started_at}` : ''}{item.ended_at ? ` · Ended ${item.ended_at}` : ''}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span></div>
      {editing === item.id ? <div className="mt-4 grid gap-3 md:grid-cols-3"><RecessedInput label="Dosage" value={edit.dosage} onChange={event => setEdit({ ...edit, dosage: event.target.value })} /><RecessedInput label="Frequency" value={edit.frequency} onChange={event => setEdit({ ...edit, frequency: event.target.value })} /><RecessedInput label="Notes" value={edit.notes} onChange={event => setEdit({ ...edit, notes: event.target.value })} /><div className="flex gap-2 md:col-span-3"><TactileButton size="sm" isLoading={busy === item.id} onClick={() => update(item.id, edit, 'Medicine details updated.')} leftIcon={<Save className="h-4 w-4" />}>Save</TactileButton><TactileButton size="sm" variant="secondary" onClick={() => setEditing('')}>Cancel</TactileButton></div></div> : <><dl className="mt-4 grid gap-2 text-sm sm:grid-cols-3"><div><dt className="text-slate-500">Dosage</dt><dd>{item.dosage || 'Not provided'}</dd></div><div><dt className="text-slate-500">Frequency</dt><dd>{item.frequency || 'Not provided'}</dd></div><div><dt className="text-slate-500">Notes</dt><dd>{item.notes || 'None'}</dd></div></dl>{item.status === 'active' && <div className="mt-4 flex gap-2"><TactileButton size="sm" variant="secondary" onClick={() => startEdit(item)}>Edit details</TactileButton><TactileButton size="sm" variant="danger" isLoading={busy === item.id} onClick={() => update(item.id, { status: 'discontinued' }, 'Medicine moved to discontinued history.')} leftIcon={<XCircle className="h-4 w-4" />}>Discontinue</TactileButton></div>}</>}
    </article>)}</section>
  </div>;
}
