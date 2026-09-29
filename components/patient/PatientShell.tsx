'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';

export function PatientShell({ children, email }: { children: React.ReactNode; email: string | null }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  const connected = ['/patient/dashboard', '/patient/chat', '/patient/profile', '/patient/access', '/patient/medications', '/patient/prescriptions', '/patient/reports'].includes(path);
  return <div className="min-h-screen bg-[#FAFAFA]">
    <Navbar authenticatedEmail={email} onToggleSidebar={() => setOpen(!open)} />
    <div className="mx-auto flex max-w-[1600px]">
      <Sidebar role="patient" email={email} isOpen={open} onClose={() => setOpen(false)} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        {connected ? children : <div className="rounded-xl border bg-white p-8"><h1 className="text-xl font-bold">This feature is not available yet</h1><p className="mt-3 text-slate-600">Your account and profile are connected. Medication analysis, uploads and history will become available as their workflows are completed.</p><Link className="mt-5 inline-block text-blue-600 hover:underline" href="/patient/dashboard">Return to dashboard</Link></div>}
      </main>
    </div>
  </div>;
}
