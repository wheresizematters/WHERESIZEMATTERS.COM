import { Platform } from 'react-native';

// react-native-purchases uses native modules that crash in Expo Go.
// We lazy-load it only when native modules are available.
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
  if (!loadPurchases()) return;
  const key = Platform.OS === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  if (!key) return;
  try {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    Purchases.configure({ apiKey: key, appUserID: userId });
  } catch {}
}

export async function getOfferings(): Promise<any | null> {
  if (!loadPurchases()) return null;
  try {
    const offerings = await Purchases.getOfferings();
    return offerings.current ?? null;
  } catch {
    return null;
  }
}

export async function purchasePackage(pkg: any) {
  if (!loadPurchases()) return { customerInfo: null, error: 'Purchases not available in Expo Go' };
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return { customerInfo, error: null };
  } catch (e: any) {
    if (e?.userCancelled) return { customerInfo: null, error: null };
    return { customerInfo: null, error: e?.message ?? 'Purchase failed' };
  }
}

export async function restorePurchases() {
  if (!loadPurchases()) return { customerInfo: null, error: 'Purchases not available in Expo Go' };
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
