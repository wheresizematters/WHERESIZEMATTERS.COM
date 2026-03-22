import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Session } from '@supabase/supabase-js';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase, SUPABASE_READY } from '@/lib/supabase';
import { Profile } from '@/lib/types';
import { registerPushToken } from '@/lib/notifications';

WebBrowser.maybeCompleteAuthSession();

// Demo profile used when Supabase isn't configured yet
const DEMO_PROFILE: Profile = {
  id: 'demo',
  username: 'DemoUser',
  size_inches: 6.8,
  is_verified: false,
  has_set_size: true,
  created_at: new Date().toISOString(),
};

interface AuthContextType {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, username: string, sizeInches: number) => Promise<{ error: string | null }>;
  signInWithOAuth: (provider: 'google' | 'x') => Promise<{ error: string | null }>;
  signInWithPhone: (phone: string) => Promise<{ error: string | null }>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<{ error: string | null }>;
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
      if (session) {
        fetchProfile(session.user.id);
        // Auto-follow if user arrived via an invite link
        if (typeof window !== 'undefined') {
          const inviteFrom = sessionStorage.getItem('size_invite_from');
          const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (inviteFrom && UUID_REGEX.test(inviteFrom) && inviteFrom !== session.user.id) {
            sessionStorage.removeItem('size_invite_from');
            supabase.from('follows').upsert([
              { follower_id: session.user.id, following_id: inviteFrom },
              { follower_id: inviteFrom, following_id: session.user.id },
            ]).then(() => {});
          } else if (inviteFrom) {
            // Invalid value — clear it
            sessionStorage.removeItem('size_invite_from');
          }
        }
      } else { setProfile(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (!data) {
      // DB trigger may not have fired yet for new OAuth users — retry once
      await new Promise(r => setTimeout(r, 1200));
      const { data: retried } = await supabase.from('profiles').select('*').eq('id', userId).single();
      setProfile(retried ?? null);
    } else {
      setProfile(data);
    }
    setLoading(false);
    // Register for push notifications in the background — don't block auth flow
    registerPushToken(userId).catch(() => {});
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

  async function signInWithOAuth(provider: 'google' | 'x') {
    if (!SUPABASE_READY) return { error: 'Supabase not configured' };

    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: 'https://www.wheresizematters.com/' },
      });
      return { error: error?.message ?? null };
    }

    // Native: open OAuth in browser, handle deep link callback
    const redirectUri = Linking.createURL('auth/callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUri, skipBrowserRedirect: true },
    });
    if (error || !data.url) return { error: error?.message ?? 'OAuth failed' };

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
    if (result.type === 'success') {
      // Handle both hash fragment (#access_token=...) and query param (?code=...) flows
      const hash = result.url.split('#')[1] ?? '';
      const query = result.url.split('?')[1] ?? '';
      const hashParams = new URLSearchParams(hash);
      const queryParams = new URLSearchParams(query);

      const access_token = hashParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token');
      const code = queryParams.get('code');

      if (access_token && refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
        return { error: sessionError?.message ?? null };
      } else if (code) {
        const { error: codeError } = await supabase.auth.exchangeCodeForSession(code);
        return { error: codeError?.message ?? null };
      }
    }
    return { error: null };
  }

  async function signInWithPhone(phone: string) {
    if (!SUPABASE_READY) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithOtp({ phone });
    return { error: error?.message ?? null };
  }

  async function verifyPhoneOtp(phone: string, token: string) {
    if (!SUPABASE_READY) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    if (!SUPABASE_READY) return;
    await supabase.auth.signOut();
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!SUPABASE_READY || !session) return;
    // Try update first; if no row exists (new OAuth user), upsert it
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select()
      .single();
    if (data) {
      setProfile(data);
    } else if (error) {
      // Row may not exist yet — upsert with safe defaults
      const { data: upserted } = await supabase
        .from('profiles')
        .upsert({ id: session.user.id, username: session.user.email?.split('@')[0] ?? session.user.id.slice(0, 8), size_inches: 6.0, ...updates })
        .select()
        .single();
      if (upserted) setProfile(upserted);
    }
  }

  return (
    <AuthContext.Provider value={{ session, profile, loading, demoMode: !SUPABASE_READY, signIn, signUp, signInWithOAuth, signInWithPhone, verifyPhoneOtp, signOut, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
