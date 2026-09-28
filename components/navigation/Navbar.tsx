'use client';
import Link from 'next/link';
import { Menu } from 'lucide-react';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { TactileButton } from '@/components/ui/TactileButton';

export function Navbar({ onToggleSidebar, dashboardHref = '/patient/dashboard', authenticatedEmail }: { onToggleSidebar?: () => void; onOpenCommandPalette?: () => void; dashboardHref?: string; authenticatedEmail?: string | null }) {
  return <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
    <div className="mx-auto flex min-h-16 max-w-[1600px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
      <div className="flex items-center gap-3">
        {onToggleSidebar && <button className="rounded-lg p-2 lg:hidden" onClick={onToggleSidebar} aria-label="Toggle menu"><Menu className="h-5 w-5" /></button>}
        <BrandLogo size="md" />
      </div>
      {authenticatedEmail !== undefined ? <div className="flex items-center gap-3">
        <Link href={dashboardHref} className="text-sm font-semibold text-blue-600">Dashboard</Link>
        {authenticatedEmail ? <span className="hidden max-w-48 truncate text-xs text-slate-500 sm:block">{authenticatedEmail}</span> : null}
      </div> : <div className="flex gap-2"><Link href="/login"><TactileButton variant="secondary" size="sm">Sign in</TactileButton></Link><Link href="/signup"><TactileButton size="sm">Create account</TactileButton></Link></div>}
    </div>
  </header>;
}
