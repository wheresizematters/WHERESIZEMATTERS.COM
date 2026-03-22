import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  initPurchases, getOfferings, purchasePackage,
  restorePurchases, isPremiumUser, stripeCheckout,
} from '@/lib/purchases';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface PurchaseContextType {
  isPremium: boolean;
  offerings: any | null;
  customerInfo: any | null;
  loading: boolean;
  purchase: (pkg: any) => Promise<{ error: string | null }>;
  purchaseWeb: (plan: 'monthly' | 'annual') => Promise<void>;
  restore: () => Promise<{ error: string | null }>;
}

const PurchaseContext = createContext<PurchaseContextType | null>(null);

export function PurchaseProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [offerings, setOfferings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [webPremium, setWebPremium] = useState(false);

  // On web: read is_premium from Supabase profile
  useEffect(() => {
    if (Platform.OS !== 'web' || !session?.user.id) return;

    async function checkWebPremium() {
      const { data } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', session!.user.id)
        .single();
      setWebPremium(data?.is_premium ?? false);
      setLoading(false);
    }

    checkWebPremium();

    // Also check if user just returned from Stripe
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscribed') === '1') {
        // Poll briefly for webhook to update DB
        let attempts = 0;
        const interval = setInterval(async () => {
          const { data } = await supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', session!.user.id)
            .single();
          if (data?.is_premium) {
            setWebPremium(true);
            clearInterval(interval);
            // Clean up URL param
            window.history.replaceState({}, '', window.location.pathname);
          }
          if (++attempts >= 10) clearInterval(interval);
        }, 2000);
      }
    }
  }, [session?.user.id]);

  // On native: use RevenueCat
  useEffect(() => {
    if (Platform.OS === 'web') return;
    initPurchases(session?.user.id);
    getOfferings().then(setOfferings);
    setLoading(false);
  }, [session?.user.id]);

  async function purchase(pkg: any) {
    const { customerInfo, error } = await purchasePackage(pkg);
    if (customerInfo) setCustomerInfo(customerInfo);
    return { error };
  }

  async function purchaseWeb(plan: 'monthly' | 'annual') {
    if (!session?.user.id) throw new Error('Not logged in');
    await stripeCheckout(plan, session.user.id);
  }

  async function restore() {
    const { customerInfo, error } = await restorePurchases();
    if (customerInfo) setCustomerInfo(customerInfo);
    return { error };
  }

  const isPremium = Platform.OS === 'web' ? webPremium : isPremiumUser(customerInfo);

  return (
    <PurchaseContext.Provider value={{
      isPremium,
      offerings,
      customerInfo,
      loading,
      purchase,
      purchaseWeb,
      restore,
    }}>
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error('usePurchase must be used within PurchaseProvider');
  return ctx;
}
