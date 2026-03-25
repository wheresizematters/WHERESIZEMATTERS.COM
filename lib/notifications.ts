// PWA notification stubs — no native push tokens needed.
// Web Push (via service worker) can be added here later if needed.

export async function registerPushToken(_userId: string): Promise<void> {
  // No-op for PWA — Expo push tokens are native-only.
  // Web push via service worker can be wired here in the future.
}

export function addNotificationListener(
  _onNotification: (notification: any) => void,
): { remove: () => void } {
  return { remove: () => {} };
}

export function addNotificationResponseListener(
  _onResponse: (response: any) => void,
): { remove: () => void } {
  return { remove: () => {} };
}
