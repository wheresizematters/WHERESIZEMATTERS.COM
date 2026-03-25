/**
 * API client — all requests go through the AWS backend.
 * On production, Vercel proxies /api/* to the EC2 backend (same-origin, HTTPS).
 * EXPO_PUBLIC_API_URL can be set for local dev pointing to localhost:3000.
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
  // If EXPO_PUBLIC_API_URL is set (e.g. local dev), use it.
  // Otherwise use same-origin (Vercel proxies /api/* to backend).
  return API_URL;
}

// API is always ready — either via env var or same-origin proxy
export const SUPABASE_READY = true;

export const supabase = null as any;
