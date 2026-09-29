'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';

const AuthContext = createContext<{ user: User | null; loading: boolean }>({ user: null, loading: true });
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    let changed = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;
      changed = true;
      if (active) { setUser(session?.user ?? null); setLoading(false); }
    });
    supabase.auth.getUser().then(({ data }) => {
      if (active && !changed) { setUser(data.user); setLoading(false); }
    }).catch(() => { if (active && !changed) { setUser(null); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
