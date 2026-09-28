import { redirect } from 'next/navigation';
import { currentAccount } from '@/lib/server/account';
import { PatientShell } from '@/components/patient/PatientShell';
export const dynamic = 'force-dynamic';
export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const current = await currentAccount();
  if (!current) redirect('/login');
  if (current.account.account_type === 'doctor') redirect('/doctor/dashboard');
  return <PatientShell email={current.user.email || null}>{children}</PatientShell>;
}
