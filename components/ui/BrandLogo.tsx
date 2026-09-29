'use client';

import React from 'react';
import Link from 'next/link';
import { clsx } from 'clsx';

export interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showBadge?: boolean;
  clickable?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 'md',
  showBadge = false,
  clickable = true,
  className,
}) => {
  const iconSizes = {
    sm: 'w-7 h-7 text-xs rounded-lg',
    md: 'w-9 h-9 text-sm rounded-xl',
    lg: 'w-11 h-11 text-base rounded-2xl',
  };

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
  };

  const content = (
    <div className={clsx('flex items-center gap-2.5 group select-none', className)}>
      {/* Initials Badge: MS / MedSafe AI with tactile gradient and bevel highlight */}
      <div
        className={clsx(
          'relative bg-gradient-to-br from-[#2563EB] via-[#1D4ED8] to-[#1E3A8A] text-white flex items-center justify-center font-black font-mono tracking-tight shadow-[inset_0_1px_0_0_rgba(255,255,255,0.45),0_2px_6px_0_rgba(37,99,235,0.35)] border border-blue-400/30 group-hover:scale-105 transition-transform shrink-0',
          iconSizes[size]
        )}
      >
        <span className="leading-none drop-shadow-xs">MS</span>
        {/* Subtle medical dot highlight */}
        <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-teal-400 ring-2 ring-white" />
      </div>

      {/* Brand Typography */}
      <div className="flex items-center gap-1.5 leading-none">
        <span className={clsx('font-extrabold text-slate-900 tracking-tight font-sans', textSizes[size])}>
          MedSafe <span className="text-[#2563EB]">AI</span>
        </span>
        {showBadge && (
          <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 shrink-0">
            SVNIT
          </span>
        )}
      </div>
    </div>
  );

  if (clickable) {
    return <Link href="/" className="inline-flex items-center">{content}</Link>;
  }

  return content;
};
