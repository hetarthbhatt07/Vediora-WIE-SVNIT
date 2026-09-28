'use client';
import { useEffect, useState } from 'react';
import { Stethoscope } from 'lucide-react';
import { DoctorReportView, type DoctorReport } from '@/components/doctor/DoctorReportView';
import { TactileButton } from '@/components/ui/TactileButton';
import { markWorkspaceUpdated } from '@/lib/workspace-sync';

interface Patient { id:string; full_name:string; email:string; }
export default function DoctorAnalysisPage(){
  const [patients,setPatients]=useState<Patient[]>([]); const [patientId,setPatientId]=useState(''); const [report,setReport]=useState<DoctorReport|null>(null); const [busy,setBusy]=useState(false); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  useEffect(()=>{fetch('/api/doctor/workspace',{cache:'no-store'}).then(async r=>{const b=await r.json();if(!r.ok)throw new Error(b.error);setPatients(b.patients||[]);setPatientId(b.patients?.[0]?.id||'');}).catch(e=>setError(e.message||'Could not load approved patients.')).finally(()=>setLoading(false));},[]);
  async function review(){setBusy(true);setError('');setReport(null);try{const r=await fetch('/api/doctor/reports',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patient_id:patientId,prescription_id:null})});const b=await r.json();if(!r.ok)throw new Error(b.error);setReport(b.report);markWorkspaceUpdated('doctor');markWorkspaceUpdated('patient');}catch(e){setError(e instanceof Error?e.message:'Could not generate review.');}finally{setBusy(false);}}
  return <div className="space-y-6"><header className="rounded-2xl border bg-white p-6"><p className="text-xs font-semibold uppercase text-teal-700">Doctor workspace</p><h1 className="mt-2 text-2xl font-bold">Clinical medicine review</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review the current active medicine list of an approved patient. Vediora creates findings only from imported interaction records and saves an immutable report version.</p></header>{error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <section className="rounded-2xl border bg-white p-6"><div className="grid items-end gap-4 md:grid-cols-[1fr_auto]"><label className="text-xs font-semibold text-slate-700">Approved patient<select disabled={loading} value={patientId} onChange={e=>setPatientId(e.target.value)} className="mt-2 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"><option value="">Select a patient</option>{patients.map(p=><option key={p.id} value={p.id}>{p.full_name} · {p.email}</option>)}</select></label><TactileButton disabled={!patientId} isLoading={busy} onClick={review} leftIcon={<Stethoscope className="h-4 w-4"/>}>Run clinical review</TactileButton></div>{!loading&&patients.length===0&&<p className="mt-4 text-sm text-slate-500">No approved patients are available. Send an access request and wait for the patient to approve it.</p>}</section>
    {report&&<DoctorReportView report={report}/>}</div>;
}
