import Link from 'next/link';
import { AccessPendingShell } from '@/components/navigation/AccessPendingShell';
import { currentAccount } from '@/lib/server/account';

export default async function AccessPendingPage() {
  const current = await currentAccount();
  const role = current?.account.account_type === 'doctor' ? 'doctor' : 'patient';
  const dashboardHref = role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard';
  return <AccessPendingShell email={current?.user.email || null} role={role}><div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm"><h1 className="text-2xl font-bold">This workspace is not available for your account</h1><p className="mt-4 leading-6 text-slate-600">Patient and doctor workspaces are separated by the account type stored in Supabase. Doctor access to a patient still requires an approved request from that patient.</p><Link href={dashboardHref} className="mt-6 inline-block font-semibold text-blue-600 hover:underline">Open your account dashboard</Link></div></AccessPendingShell>;
}
