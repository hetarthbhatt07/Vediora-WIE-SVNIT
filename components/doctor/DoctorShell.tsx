'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';

export function DoctorShell({ children, email }: { children: React.ReactNode; email: string | null }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const connected = ['/doctor/dashboard', '/doctor/chat', '/doctor/patients', '/doctor/profile', '/doctor/analysis', '/doctor/reports'].includes(path)
    || path.startsWith('/doctor/patients/');
  return <div className="min-h-screen bg-[#FAFAFA]">
    <Navbar authenticatedEmail={email} dashboardHref="/doctor/dashboard" onToggleSidebar={() => setOpen(!open)} />
    <div className="mx-auto flex max-w-[1600px]">
      <Sidebar role="doctor" email={email} isOpen={open} onClose={() => setOpen(false)} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        {connected ? children : <div className="rounded-xl border bg-white p-8"><h1 className="text-xl font-bold">This clinical module is not connected yet</h1><p className="mt-3 text-slate-600">The consent-based patient directory is available. Clinical analysis and reporting will be connected after patient medicine records are persisted.</p><Link className="mt-5 inline-block text-blue-600 hover:underline" href="/doctor/dashboard">Return to doctor dashboard</Link></div>}
      </main>
    </div>
  </div>;
}
