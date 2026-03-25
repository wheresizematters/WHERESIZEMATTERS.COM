/**
 * API client — all requests go through the AWS backend.
 * Supabase has been fully removed. Auth is JWT-based via our own API.
 */

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? '';

// Token management
let _accessToken: string | null = null;

export function getToken(): string | null {
  if (_accessToken) return _accessToken;
  if (typeof window !== 'undefined') {
    return localStorage.getItem('size_token');
  }
  return null;
}

export function setToken(token: string | null): void {
  _accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('size_token', token);
    else localStorage.removeItem('size_token');
  }
}

export function getApiUrl(): string {
  return API_URL;
}

export const SUPABASE_READY = API_URL.length > 0;

// Keep this export name for backward compat during migration
// but it's really just a marker that the API is configured
export const supabase = null as any;
