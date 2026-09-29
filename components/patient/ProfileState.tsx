'use client';
import { TactileButton } from '@/components/ui/TactileButton';
export function ProfileState({ loading, error, retry }: { loading: boolean; error: string; retry: () => void }) {
  if (loading) return <p role="status" className="p-8 text-slate-500">Loading your profile…</p>;
  return <div className="rounded-xl border border-red-200 bg-white p-6"><p role="alert" className="mb-4 text-red-700">{error || 'Your profile is unavailable.'}</p><TactileButton onClick={retry} variant="secondary">Try again</TactileButton></div>;
}
