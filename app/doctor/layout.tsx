import { redirect } from 'next/navigation';
import { currentAccount } from '@/lib/server/account';
import { DoctorShell } from '@/components/doctor/DoctorShell';

export const dynamic = 'force-dynamic';

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const current = await currentAccount();
  if (!current) redirect('/login');
  if (current.account.account_type !== 'doctor') redirect('/access-pending');
  return <DoctorShell email={current.user.email || null}>{children}</DoctorShell>;
}
