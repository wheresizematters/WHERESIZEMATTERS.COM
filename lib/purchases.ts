import { Platform } from 'react-native';

// ── Stripe (web) ──────────────────────────────────────────────────────────────
export const STRIPE_PUBLISHABLE_KEY = 'pk_test_51TDr6WRgeoqeXUgeg1i0V3Uz8NwJGGwydjBDXaYvTVrZzkYu2swsZHvgsAiFiyAZBVuKlF2Rqub5uVNFbeITAYF100mQVQIJep';
export const STRIPE_PRICE_MONTHLY = 'price_1TDrAIRgeoqeXUge2NFprjqt';
export const STRIPE_PRICE_ANNUAL  = 'price_1TDrApRgeoqeXUgeFR8rUpD6';

// Stripe Payment Links — no backend needed
const STRIPE_LINK_MONTHLY = 'https://buy.stripe.com/test_3cIfZj3TngiY3DjfQC9Zm01';
const STRIPE_LINK_ANNUAL  = 'https://buy.stripe.com/test_3cI28tblPeaQa1H1ZM9Zm00';

export async function stripeCheckout(plan: 'monthly' | 'annual', userId: string) {
  const base = plan === 'annual' ? STRIPE_LINK_ANNUAL : STRIPE_LINK_MONTHLY;
  // client_reference_id lets the webhook identify the user
  window.location.href = `${base}?client_reference_id=${userId}`;
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
