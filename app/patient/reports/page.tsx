'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, FileCheck, Printer, RefreshCw, ShieldCheck } from 'lucide-react';
import { TactileButton } from '@/components/ui/TactileButton';
import { markWorkspaceUpdated } from '@/lib/workspace-sync';

interface Prescription { id: string; prescriber_name: string | null; prescribed_on: string | null; items: Array<{ medicine_name: string }>; }
interface Finding { id: number; pair: string; severity: string | null; type: string | null; description: string | null; clinicalEffect: string | null; evidenceSource: string | null; referenceUrl: string | null; }
interface Snapshot { medicines: Array<{ drug_id: number; medicine_name: string }>; findings: Finding[]; missingPairs: string[]; limitation: string; }
interface Report { id: string; prescription_id: string | null; version: number; overall_severity: string; summary: string; evidence_snapshot: Snapshot; created_at: string; }

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [selectedPrescription, setSelectedPrescription] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [reportResponse, prescriptionResponse] = await Promise.all([fetch('/api/patient/reports', { cache: 'no-store' }), fetch('/api/patient/prescriptions', { cache: 'no-store' })]);
      const reportBody = await reportResponse.json(); const prescriptionBody = await prescriptionResponse.json();
      if (!reportResponse.ok) throw new Error(reportBody.error); if (!prescriptionResponse.ok) throw new Error(prescriptionBody.error);
      setReports(reportBody.reports || []); setPrescriptions(prescriptionBody.prescriptions || []); setSelectedId(current => current || reportBody.reports?.[0]?.id || '');
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load reports.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const selected = useMemo(() => reports.find(report => report.id === selectedId) || reports[0], [reports, selectedId]);
  async function generate() {
    setBusy(true); setError('');
    try { const response = await fetch('/api/patient/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prescription_id: selectedPrescription || null }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); setReports(current => [body.report, ...current]); setSelectedId(body.report.id); markWorkspaceUpdated('patient'); markWorkspaceUpdated('doctor'); }
    catch (error) { setError(error instanceof Error ? error.message : 'Could not generate report.'); }
    finally { setBusy(false); }
  }
  const severityStyle = (severity: string) => severity.toLowerCase() === 'major' ? 'bg-red-50 text-red-700 border-red-200' : severity.toLowerCase() === 'moderate' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-blue-50 text-blue-700 border-blue-200';
  return <div className="space-y-6">
    <header className="rounded-2xl border bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Patient workspace</p><h1 className="mt-2 text-2xl font-bold">Evidence-linked reports</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Generate a versioned safety report from your active medicines and an optional confirmed prescription. Every finding below is copied from the imported interaction database at generation time.</p></header>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="no-print rounded-2xl border bg-white p-5"><div className="grid items-end gap-4 md:grid-cols-[1fr_auto]"><label className="text-xs font-semibold text-slate-700">Include a confirmed prescription<select value={selectedPrescription} onChange={event => setSelectedPrescription(event.target.value)} className="mt-2 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"><option value="">Active medicines only</option>{prescriptions.map(prescription => <option key={prescription.id} value={prescription.id}>{prescription.prescriber_name || 'Prescription'} · {prescription.prescribed_on || 'No date'} · {prescription.items.length} medicines</option>)}</select></label><TactileButton onClick={generate} isLoading={busy} leftIcon={<RefreshCw className="h-4 w-4" />}>Generate new version</TactileButton></div><p className="mt-3 text-xs text-slate-500">A report needs at least two unique medicines. Missing records are shown as uncertainty, never as proof of safety.</p></section>
    {loading ? <p className="text-sm text-slate-500">Loading reports…</p> : reports.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-10 text-center"><FileCheck className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-3 font-bold">No evidence report generated yet</h2><p className="mt-1 text-sm text-slate-500">Add two active medicines or select a confirmed prescription, then generate the first version.</p></div> : <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
      <aside className="no-print h-fit rounded-xl border bg-white p-3"><h2 className="px-2 py-2 text-sm font-bold">Report versions</h2><div className="space-y-2">{reports.map(report => <button key={report.id} onClick={() => setSelectedId(report.id)} className={`w-full rounded-lg border p-3 text-left ${selected?.id === report.id ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}><span className="block text-sm font-bold">Version {report.version}</span><span className="mt-1 block text-xs text-slate-500">{new Date(report.created_at).toLocaleString()}</span></button>)}</div></aside>
      {selected && <article className="rounded-2xl border bg-white p-6 sm:p-8"><div className="flex flex-wrap items-start justify-between gap-4 border-b pb-5"><div><p className="text-xs font-semibold uppercase text-blue-600">Vediora safety report · Version {selected.version}</p><h2 className="mt-2 text-xl font-bold">Medication interaction evidence</h2><p className="mt-1 text-xs text-slate-500">Generated {new Date(selected.created_at).toLocaleString()}</p></div><div className="flex items-center gap-2"><span className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${severityStyle(selected.overall_severity)}`}>{selected.overall_severity}</span><TactileButton className="no-print" size="sm" variant="secondary" onClick={() => window.print()} leftIcon={<Printer className="h-4 w-4" />}>Print / PDF</TactileButton></div></div>
        <div className="mt-6 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">{selected.summary}</div>
        <section className="mt-6"><h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-teal-600" />Medicines checked</h3><div className="mt-3 flex flex-wrap gap-2">{selected.evidence_snapshot.medicines.map(medicine => <span key={medicine.drug_id} className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800">{medicine.medicine_name}</span>)}</div></section>
        <section className="mt-6 space-y-3"><h3 className="font-bold">Documented findings ({selected.evidence_snapshot.findings.length})</h3>{selected.evidence_snapshot.findings.length === 0 ? <p className="rounded-xl border border-dashed p-4 text-sm text-slate-600">No interaction record was found for the checked pairs in the current database. This is not a guarantee that the combination is safe.</p> : selected.evidence_snapshot.findings.map(finding => <div key={finding.id} className={`rounded-xl border p-4 ${severityStyle(finding.severity || 'unknown')}`}><div className="flex flex-wrap justify-between gap-2"><h4 className="font-bold">{finding.pair}</h4><span className="text-xs font-bold uppercase">{finding.severity || 'Severity not recorded'}</span></div>{finding.description && <p className="mt-3 text-sm leading-6">{finding.description}</p>}{finding.clinicalEffect && <p className="mt-2 text-sm leading-6"><strong>Clinical effect:</strong> {finding.clinicalEffect}</p>}<div className="mt-3 flex flex-wrap items-center gap-3 text-xs"><span>Source: {finding.evidenceSource || 'Imported interaction record'}</span>{finding.referenceUrl && <a href={finding.referenceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold underline">Open reference <ExternalLink className="h-3 w-3" /></a>}</div></div>)}</section>
        {selected.evidence_snapshot.missingPairs.length > 0 && <section className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"><h3 className="flex items-center gap-2 font-bold text-amber-950"><AlertTriangle className="h-5 w-5" />Pairs without a database record</h3><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">{selected.evidence_snapshot.missingPairs.map(pair => <li key={pair}>{pair}</li>)}</ul></section>}
        <p className="mt-6 border-t pt-5 text-xs leading-5 text-slate-500">{selected.evidence_snapshot.limitation}</p>
      </article>}
    </div>}
  </div>;
}
