'use client';
import { useCallback, useEffect, useState } from 'react';
import { Check, ShieldCheck, UserRoundCheck, X } from 'lucide-react';
import { TactileButton } from '@/components/ui/TactileButton';
import { markWorkspaceUpdated } from '@/lib/workspace-sync';

interface AccessRequest {
  id: string;
  doctor_name: string;
  doctor_email: string;
  license_number: string;
  specialization: string | null;
  organization: string | null;
  verification_status: string;
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  request_message: string | null;
  requested_at: string;
}

export function PatientAccessManager() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/patient/access-requests', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load access requests.');
      setRequests(body.requests || []);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not load access requests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function respond(id: string, action: 'approve' | 'deny' | 'revoke') {
    setBusy(id); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/patient/access-requests/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not update access.');
      setMessage(action === 'approve' ? 'Doctor access approved.' : action === 'deny' ? 'Access request denied.' : 'Doctor access revoked.');
      markWorkspaceUpdated('patient');
      markWorkspaceUpdated('doctor');
      await load();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not update access.'); }
    finally { setBusy(''); }
  }

  if (loading) return <p role="status" className="text-sm text-slate-500">Loading doctor access requests…</p>;
  return <div className="space-y-4">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    {message && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {requests.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center"><UserRoundCheck className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 text-sm font-semibold text-slate-700">No doctor access requests</p><p className="mt-1 text-xs text-slate-500">Requests sent to your account will appear here.</p></div> : requests.map(item => <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="font-bold text-slate-900">{item.doctor_name}</h2><p className="text-sm text-slate-500">{item.specialization || 'Specialization not provided'}{item.organization ? ` · ${item.organization}` : ''}</p><p className="mt-1 text-xs text-slate-500">License: {item.license_number} · Verification: {item.verification_status}</p></div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${item.status === 'approved' ? 'bg-emerald-50 text-emerald-700' : item.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{item.status}</span>
      </div>
      {item.request_message && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{item.request_message}</p>}
      <p className="mt-3 text-xs text-slate-400">Requested {new Date(item.requested_at).toLocaleString()}</p>
      {item.status === 'pending' && <div className="mt-4 flex gap-2"><TactileButton onClick={() => respond(item.id, 'approve')} isLoading={busy === item.id} leftIcon={<Check className="h-4 w-4" />} variant="success">Approve</TactileButton><TactileButton onClick={() => respond(item.id, 'deny')} disabled={!!busy} leftIcon={<X className="h-4 w-4" />} variant="secondary">Deny</TactileButton></div>}
      {item.status === 'approved' && <div className="mt-4"><TactileButton onClick={() => respond(item.id, 'revoke')} isLoading={busy === item.id} leftIcon={<ShieldCheck className="h-4 w-4" />} variant="danger">Revoke access</TactileButton></div>}
    </article>)}
  </div>;
}
