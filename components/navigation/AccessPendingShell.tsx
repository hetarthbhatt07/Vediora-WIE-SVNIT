'use client';

import { useState } from 'react';
import { Navbar } from '@/components/navigation/Navbar';
import { Sidebar } from '@/components/navigation/Sidebar';

export function AccessPendingShell({ children, email, role }: { children: React.ReactNode; email: string | null; role: 'patient' | 'doctor' }) {
  const [open, setOpen] = useState(false);
  const dashboardHref = role === 'doctor' ? '/doctor/dashboard' : '/patient/dashboard';
  return <div className="min-h-screen bg-[#FAFAFA]">
    <Navbar authenticatedEmail={email} dashboardHref={dashboardHref} onToggleSidebar={() => setOpen(!open)} />
    <div className="mx-auto flex max-w-[1600px]">
      <Sidebar role={role} email={email} isOpen={open} onClose={() => setOpen(false)} />
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  </div>;
}
