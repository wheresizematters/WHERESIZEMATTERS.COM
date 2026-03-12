import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase, SUPABASE_READY } from '@/lib/supabase';
import { Profile } from '@/lib/types';

// Demo profile used when Supabase isn't configured yet
const DEMO_PROFILE: Profile = {
  id: 'demo',
  username: 'DemoUser',
  size_inches: 6.8,
  is_verified: false,
  created_at: new Date().toISOString(),
};

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string, sizeInches: number) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Demo mode — skip Supabase entirely
    if (!SUPABASE_READY) {
      setProfile(DEMO_PROFILE);
      setSession({ user: { id: 'demo' } } as any);
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data);
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    if (!SUPABASE_READY) return { error: 'Supabase not configured — running in demo mode' };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, username: string, sizeInches: number) {
    if (!SUPABASE_READY) return { error: 'Supabase not configured — running in demo mode' };
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: username.trim(), size_inches: sizeInches } },
    });
    if (error) return { error: error.message };
    return { error: null };
  }

  async function signOut() {
    if (!SUPABASE_READY) return;
    await supabase.auth.signOut();
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!SUPABASE_READY || !session) return;
    const { data } = await supabase.from('profiles').update(updates).eq('id', session.user.id).select().single();
    if (data) setProfile(data);
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, demoMode: !SUPABASE_READY, signIn, signUp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
