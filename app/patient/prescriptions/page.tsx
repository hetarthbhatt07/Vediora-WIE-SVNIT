'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, FileText, Plus, Trash2 } from 'lucide-react';
import { RecessedInput } from '@/components/ui/RecessedInput';
import { TactileButton } from '@/components/ui/TactileButton';
import { markWorkspaceUpdated } from '@/lib/workspace-sync';

interface Item { id: string; medicine_name: string; dosage: string | null; frequency: string | null; duration: string | null; instructions: string | null; added_to_profile: boolean; }
interface Prescription { id: string; prescriber_name: string | null; prescribed_on: string | null; notes: string | null; status: string; created_at: string; items: Item[]; }
type DraftItem = { medicine_name: string; dosage: string; frequency: string; duration: string; instructions: string; add_to_profile: boolean };
const blankItem = (): DraftItem => ({ medicine_name: '', dosage: '', frequency: '', duration: '', instructions: '', add_to_profile: true });

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [items, setItems] = useState<DraftItem[]>([blankItem()]);
  const [prescriber, setPrescriber] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { const response = await fetch('/api/patient/prescriptions', { cache: 'no-store' }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setPrescriptions(body.prescriptions || []); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not load prescriptions.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const updateItem = (index: number, patch: Partial<DraftItem>) => setItems(current => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/patient/prescriptions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prescriber_name: prescriber, prescribed_on: date, notes, confirmed, items }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error);
      setPrescriber(''); setDate(''); setNotes(''); setItems([blankItem()]); setConfirmed(false);
      markWorkspaceUpdated('patient');
      setMessage('Confirmed prescription saved. Selected medicines are now reflected in My medicines.'); await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save prescription.'); }
    finally { setSaving(false); }
  }
  return <div className="space-y-6">
    <header className="rounded-2xl border bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Patient workspace</p><h1 className="mt-2 text-2xl font-bold">Prescriptions</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Enter the medicines exactly as shown, review them, and confirm before saving. Vediora matches every medicine to the imported database; it never treats unconfirmed OCR text as clinical data.</p></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <form onSubmit={save} className="space-y-5 rounded-2xl border bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="flex items-center gap-2 font-bold"><ClipboardCheck className="h-5 w-5 text-blue-600" />Add a confirmed prescription</h2><p className="mt-1 text-xs text-slate-500">Manual entry is connected now. Image and PDF OCR will be added after secure document storage is configured.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Manual entry</span></div>
      <div className="grid gap-4 sm:grid-cols-2"><RecessedInput label="Prescriber name" value={prescriber} onChange={event => setPrescriber(event.target.value)} maxLength={200} placeholder="Doctor or clinic" /><RecessedInput label="Prescription date" type="date" max={new Date().toISOString().slice(0, 10)} value={date} onChange={event => setDate(event.target.value)} /></div>
      <div className="space-y-4">{items.map((item, index) => <div key={index} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">Medicine {index + 1}</h3>{items.length > 1 && <button type="button" aria-label={`Remove medicine ${index + 1}`} onClick={() => setItems(current => current.filter((_, itemIndex) => itemIndex !== index))} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}</div><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><RecessedInput label="Exact medicine name" required value={item.medicine_name} onChange={event => updateItem(index, { medicine_name: event.target.value })} placeholder="For example: warfarin" /><RecessedInput label="Dosage" value={item.dosage} onChange={event => updateItem(index, { dosage: event.target.value })} placeholder="5 mg" /><RecessedInput label="Frequency" value={item.frequency} onChange={event => updateItem(index, { frequency: event.target.value })} placeholder="Once daily" /><RecessedInput label="Duration" value={item.duration} onChange={event => updateItem(index, { duration: event.target.value })} placeholder="30 days" /></div><RecessedInput className="mt-3" aria-label={`Instructions for medicine ${index + 1}`} value={item.instructions} onChange={event => updateItem(index, { instructions: event.target.value })} placeholder="Instructions, for example: after food" /><label className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-700"><input type="checkbox" checked={item.add_to_profile} onChange={event => updateItem(index, { add_to_profile: event.target.checked })} className="h-4 w-4 rounded border-slate-300" />Add or update this medicine in My medicines</label></div>)}</div>
      <TactileButton type="button" variant="secondary" size="sm" onClick={() => setItems(current => current.length < 20 ? [...current, blankItem()] : current)} leftIcon={<Plus className="h-4 w-4" />}>Add another medicine</TactileButton>
      <label className="block text-xs font-semibold text-slate-700">Prescription notes<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={1000} rows={3} className="mt-2 w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-normal focus:border-blue-500 focus:outline-none" /></label>
      <label className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><input type="checkbox" required checked={confirmed} onChange={event => setConfirmed(event.target.checked)} className="mt-0.5 h-4 w-4" /><span>I reviewed the medicine names and instructions against my prescription. I understand this record does not replace advice from my doctor or pharmacist.</span></label>
      <TactileButton type="submit" isLoading={saving} leftIcon={<ClipboardCheck className="h-4 w-4" />}>Save confirmed prescription</TactileButton>
    </form>
    <section className="space-y-3"><h2 className="text-lg font-bold">Prescription history</h2>{loading ? <p className="text-sm text-slate-500">Loading prescriptions…</p> : prescriptions.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-8 text-center"><FileText className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-3 font-semibold">No confirmed prescriptions yet</p></div> : prescriptions.map(prescription => <article key={prescription.id} className="rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-2"><div><h3 className="font-bold">{prescription.prescriber_name || 'Prescription record'}</h3><p className="mt-1 text-xs text-slate-500">{prescription.prescribed_on || new Date(prescription.created_at).toLocaleDateString()} · {prescription.items.length} medicine{prescription.items.length === 1 ? '' : 's'}</p></div><span className="h-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{prescription.status}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{prescription.items.map(item => <div key={item.id} className="rounded-lg border bg-slate-50 p-3"><p className="font-semibold text-slate-900">{item.medicine_name}</p><p className="mt-1 text-xs text-slate-600">{[item.dosage, item.frequency, item.duration].filter(Boolean).join(' · ') || 'Dose details not provided'}</p>{item.instructions && <p className="mt-1 text-xs text-slate-600">{item.instructions}</p>}<p className="mt-2 text-[11px] font-semibold text-blue-700">{item.added_to_profile ? 'Synced to My medicines' : 'Kept in this prescription only'}</p></div>)}</div>{prescription.notes && <p className="mt-3 text-sm text-slate-600">{prescription.notes}</p>}</article>)}</section>
  </div>;
}
