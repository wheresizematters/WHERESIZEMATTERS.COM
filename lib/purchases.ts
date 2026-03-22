import { Platform } from 'react-native';

// ── Stripe (web) ──────────────────────────────────────────────────────────────
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51TDr6WRgeoqeXUgeg1i0V3Uz8NwJGGwydjBDXaYvTVrZzkYu2swsZHvgsAiFiyAZBVuKlF2Rqub5uVNFbeITAYF100mQVQIJep';
export const STRIPE_PRICE_MONTHLY = 'price_1TDrAIRgeoqeXUge2NFprjqt';
export const STRIPE_PRICE_ANNUAL  = 'price_1TDrApRgeoqeXUgeFR8rUpD6';

export async function stripeCheckout(priceId: string, userId: string, email: string) {
  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

  if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase not configured');

  const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      priceId,
      userId,
      email,
      successUrl: `${window.location.origin}/?subscribed=1`,
      cancelUrl: window.location.href,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Checkout error (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (data.url) {
    window.location.href = data.url;
  } else {
    throw new Error(data.error ?? 'No checkout URL returned');
  }
}

// ── RevenueCat (native iOS/Android) ──────────────────────────────────────────
let Purchases: any = null;
let LOG_LEVEL: any = null;

function loadPurchases() {
  if (Purchases) return true;
  try {
    const mod = require('react-native-purchases');
    Purchases = mod.default ?? mod;
    LOG_LEVEL = mod.LOG_LEVEL;
    return true;
  } catch {
    return false;
  }
}

const REVENUECAT_IOS_KEY     = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';

export const ENTITLEMENT_ID = 'premium';

export function initPurchases(userId?: string) {
  if (Platform.OS === 'web') return;
  if (!loadPurchases()) return;
  const key = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  if (!key) return;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: key, appUserID: userId });
  } catch {}
}

export async function getOfferings(): Promise<any | null> {
  if (Platform.OS === 'web') return null;
  if (!loadPurchases()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: any) {
  if (Platform.OS === 'web') return { customerInfo: null, error: 'Use Stripe on web' };
  if (!loadPurchases()) return { customerInfo: null, error: 'Purchases not available' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { customerInfo, error: null };
  } catch (e: any) {
    if (e?.userCancelled) return { customerInfo: null, error: null };
    return { customerInfo: null, error: e?.message ?? 'Purchase failed' };
  }
}

export async function restorePurchases() {
  if (Platform.OS === 'web') return { customerInfo: null, error: 'Use Stripe on web' };
  if (!loadPurchases()) return { customerInfo: null, error: 'Purchases not available' };
  try {
    const customerInfo = await Purchases.restorePurchases();
    return { customerInfo, error: null };
  } catch (e: any) {
    return { customerInfo: null, error: e?.message ?? 'Restore failed' };
  }
}

export function isPremiumUser(customerInfo: any | null): boolean {
  if (!customerInfo) return false;
  return customerInfo?.entitlements?.active?.[ENTITLEMENT_ID] !== undefined;
}
