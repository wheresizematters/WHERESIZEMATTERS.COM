import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

const isConfigured =
  supabaseUrl.startsWith('https://') && supabaseAnonKey.length > 10;

const webStorage = {
  getItem: (key: string) => Promise.resolve(typeof window !== 'undefined' ? localStorage.getItem(key) : null),
  setItem: (key: string, value: string) => Promise.resolve(typeof window !== 'undefined' ? localStorage.setItem(key, value) : undefined),
  removeItem: (key: string) => Promise.resolve(typeof window !== 'undefined' ? localStorage.removeItem(key) : undefined),
};

const storage = Platform.OS === 'web' ? webStorage : AsyncStorage;

export const supabase: SupabaseClient = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: Platform.OS === 'web',
      },
    })
  : (null as unknown as SupabaseClient);

export const SUPABASE_READY = isConfigured;
