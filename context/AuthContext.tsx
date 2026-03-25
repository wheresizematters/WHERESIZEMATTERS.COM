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
  if (!API) return null;
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  try {
    const res = await fetch(`${API}${path}`, {
      method: opts?.method ?? 'GET',
      headers,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.error ?? `Request failed (${res.status})` } as any;
    }
    return res.json();
  } catch {
    return null;
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

    // Check for existing token
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
    if (!data) return { error: 'API unavailable' };
    if (data.error) return { error: data.error };
    setToken(data.token);
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
    if (!data) return { error: 'API unavailable' };
    if (data.error) return { error: data.error };
    setToken(data.token);
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

  // Check for OAuth callback token in URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      fetchMe();
    }
  }, []);

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
