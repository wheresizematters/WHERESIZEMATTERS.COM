import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, setToken, getApiUrl, SUPABASE_READY } from '@/lib/supabase';
import { Profile } from '@/lib/types';
import { registerPushToken } from '@/lib/notifications';

const API = getApiUrl();

interface AuthContextType {
  session: { user: { id: string } } | null;
  profile: Profile | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string, sizeInches: number, ageRange?: string, girthInches?: number) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: 'google' | 'x') => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  refreshProfile: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

async function apiFetch<T = any>(path: string, opts?: { method?: string; body?: any }): Promise<T | null> {
  const url = `${API}${path}`;
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    console.log(`[SIZE API] ${opts?.method ?? 'GET'} ${url}`);
    const res = await fetch(url, {
      method: opts?.method ?? 'GET',
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    console.log(`[SIZE API] Response: ${res.status}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = err.error ?? `Request failed (${res.status})`;
      console.error(`[SIZE API] Error: ${msg}`);
      return { error: msg } as any;
    }
    return res.json();
  } catch (e: any) {
    console.error(`[SIZE API] Fetch failed: ${url}`, e?.message ?? e);
    return { error: `Connection failed: ${e?.message ?? 'unknown'}` } as any;
  }
}

// Demo profile for when API isn't configured
const DEMO_PROFILE: Profile = {
  id: 'demo',
  username: 'DemoUser',
  size_inches: 6.8,
  is_verified: false,
  has_set_size: true,
  created_at: new Date().toISOString(),
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!SUPABASE_READY) {
      setProfile(DEMO_PROFILE);
      setSession({ user: { id: 'demo' } });
      setLoading(false);
      return;
    }

    // Check for OAuth callback token in URL FIRST
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('token');
      if (urlToken) {
        setToken(urlToken);
        window.history.replaceState({}, '', window.location.pathname);
        fetchMe();
        return;
      }
    }

    // Check for existing token in localStorage
    const token = getToken();
    if (token) {
      fetchMe();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchMe() {
    const data = await apiFetch<Profile & { error?: string }>('/api/v1/auth/me');
    if (data && !data.error && data.id) {
      setProfile(data);
      setSession({ user: { id: data.id } });
    } else {
      // Token expired or invalid
      setToken(null);
      setProfile(null);
      setSession(null);
    }
    setLoading(false);
  }

  async function signIn(email: string, password: string) {
    const data = await apiFetch<{ token: string; profile: Profile; error?: string }>(
      '/api/v1/auth/login',
      { method: 'POST', body: { email, password } },
    );
    if (data?.error) return { error: data.error };
    if (data.error) return { error: data.error };
    setToken(data.token);
    // Hard redirect to force full reload with token in localStorage
    if (typeof window !== 'undefined') {
      window.location.href = '/earn';
      return { error: null };
    }
    setProfile(data.profile);
    setSession({ user: { id: data.profile.id } });
    return { error: null };
  }

  async function signUp(
    email: string, password: string, username: string,
    sizeInches: number, ageRange?: string, girthInches?: number,
  ) {
    const data = await apiFetch<{ token: string; profile: Profile; error?: string }>(
      '/api/v1/auth/signup',
      { method: 'POST', body: { email, password, username, sizeInches, ageRange, girthInches } },
    );
    if (data?.error) return { error: data.error };
    if (data.error) return { error: data.error };
    setToken(data.token);
    if (typeof window !== 'undefined') {
      window.location.href = '/earn';
      return { error: null };
    }
    setProfile(data.profile);
    setSession({ user: { id: data.profile.id } });
    return { error: null };
  }

  async function signInWithOAuth(provider: 'google' | 'x') {
    // Use same-origin path — Vercel proxies /api/* to the API server
    // This gives us HTTPS which Google/X OAuth require
    if (typeof window !== 'undefined') {
      window.location.href = `/api/v1/auth/oauth/${provider}/redirect`;
    }
    return { error: null };
  }

  async function signOut() {
    setToken(null);
    setProfile(null);
    setSession(null);
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!session) return;
    const data = await apiFetch<Profile>('/api/v1/profiles/me', {
      method: 'PATCH',
      body: updates,
    });
    if (data && (data as any).id) setProfile(data);
  }

  function refreshProfile() {
    if (session) fetchMe();
  }

  // OAuth token check moved to main useEffect above

  return (
    <AuthContext.Provider value={{
      session, profile, loading,
      demoMode: !SUPABASE_READY,
      signIn, signUp, signInWithOAuth, signOut,
      updateProfile, refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
