import { getToken, getApiUrl, SUPABASE_READY } from './supabase';

export interface UserLocation {
  lat: number;
  lng: number;
}

function fuzzyCoords(lat: number, lng: number): UserLocation {
  return {
    lat: Math.round(lat * 100) / 100,
    lng: Math.round(lng * 100) / 100,
  };
}

export async function requestAndSaveLocation(userId: string): Promise<UserLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;

  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const { lat, lng } = fuzzyCoords(pos.coords.latitude, pos.coords.longitude);
        const API = getApiUrl();
        const token = getToken();
        if (SUPABASE_READY && token) {
          await fetch(`${API}/api/v1/profiles/me`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat, lng, location_updated_at: new Date().toISOString() }),
          }).catch(() => {});
        }
        resolve({ lat, lng });
      },
      () => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

export function getCurrentLocation(): Promise<UserLocation | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);
  return new Promise(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve(fuzzyCoords(pos.coords.latitude, pos.coords.longitude)),
      () => resolve(null),
      { timeout: 8000, maximumAge: 5 * 60 * 1000 },
    );
  });
}
