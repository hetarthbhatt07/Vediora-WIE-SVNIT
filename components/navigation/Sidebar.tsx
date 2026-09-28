'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, User, LockKeyhole, MessagesSquare, Stethoscope, Users, UserRoundCheck, Pill, ClipboardList, FileCheck, Activity, LogOut, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
export function Sidebar({ role = 'patient', isOpen = false, onClose, email }: { role?: 'patient' | 'doctor' | 'admin'; isOpen?: boolean; onClose?: () => void; email?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const patientItems = [
    { href: '/patient/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/patient/chat', label: 'Medicine safety chat', icon: MessagesSquare },
    { href: '/patient/medications', label: 'My medicines', icon: Pill },
    { href: '/patient/prescriptions', label: 'Prescriptions', icon: ClipboardList },
    { href: '/patient/reports', label: 'Evidence reports', icon: FileCheck },
    { href: '/patient/access', label: 'Doctor access', icon: UserRoundCheck },
    { href: '/patient/profile', label: 'My health profile', icon: User },
  ];
  const doctorItems = [
    { href: '/doctor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/doctor/chat', label: 'Medicine safety chat', icon: MessagesSquare },
    { href: '/doctor/patients', label: 'Approved patients', icon: Users },
    { href: '/doctor/analysis', label: 'Clinical medicine review', icon: Activity },
    { href: '/doctor/reports', label: 'Evidence reports', icon: FileCheck },
    { href: '/doctor/profile', label: 'Doctor profile', icon: Stethoscope },
  ];
  const items = role === 'doctor' ? doctorItems : patientItems;
  async function signOut() {
    setSigningOut(true); setSignOutError('');
    try {
      const { error } = await createClient().auth.signOut({ scope: 'local' });
      if (error) throw error;
      onClose?.();
      router.replace('/login');
      router.refresh();
    } catch { setSignOutError('Could not sign out. Please try again.'); }
    finally { setSigningOut(false); }
  }
  return <>
    {isOpen && <button aria-label="Close menu" onClick={onClose} className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden" />}
    <aside className={`fixed left-0 top-16 z-30 flex h-[calc(100vh-4rem)] w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4 transition-transform lg:sticky ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{role === 'doctor' ? 'Doctor workspace' : 'Patient workspace'}</p>
      <nav className="space-y-2">
        {items.map(item => <Link key={item.href} href={item.href} onClick={onClose} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-50'}`}><item.icon className="h-4 w-4" />{item.label}</Link>)}
      </nav>
      <div className="mt-auto space-y-3 pt-5">
        {email ? <div className="px-3"><p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Signed in as</p><p className="mt-1 truncate text-xs text-slate-600" title={email}>{email}</p></div> : null}
        <button type="button" onClick={signOut} disabled={signingOut} className="flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-wait disabled:opacity-60">
          {signingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}{signingOut ? 'Signing out…' : 'Sign out'}
        </button>
        {signOutError ? <p role="alert" className="px-2 text-xs text-red-700">{signOutError}</p> : null}
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600"><LockKeyhole className="h-4 w-4 shrink-0" /><p>{role === 'doctor' ? 'Only patient-approved profiles are available.' : 'You control access to your health profile.'}</p></div>
      </div>
    </aside>
  </>;
}
