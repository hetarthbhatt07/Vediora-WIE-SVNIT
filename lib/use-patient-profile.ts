'use client';
import { useCallback, useEffect, useState } from 'react';
import type { PatientProfile } from './patient-profile';

export function usePatientProfile() {
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError('');
    try {
      const response = await fetch('/api/patient/profile', { cache: 'no-store', signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load your profile.');
      if (!signal?.aborted) { setProfile(data.profile); setEmail(data.email || ''); }
    } catch (error) {
      if (!signal?.aborted) { setProfile(null); setError(error instanceof Error ? error.message : 'Unable to load your profile.'); }
    } finally { if (!signal?.aborted) setLoading(false); }
  }, []);
  useEffect(() => { const controller = new AbortController(); void load(controller.signal); return () => controller.abort(); }, [load]);
  return { profile, email, loading, error, reload: () => load() };
}
