import React, { createContext, useContext, useEffect, useState } from 'react';
import { stripeCheckout } from '@/lib/purchases';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface PurchaseContextType {
  isPremium: boolean;
  loading: boolean;
  purchaseWeb: (plan: 'monthly' | 'annual') => Promise<void>;
}

const PurchaseContext = createContext<PurchaseContextType | null>(null);

export function PurchaseProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user.id) { setLoading(false); return; }

    async function checkPremium() {
      const { data } = await supabase
        .from('profiles')
        .select('is_premium')
        .eq('id', session!.user.id)
        .single();
      setIsPremium(data?.is_premium ?? false);
      setLoading(false);
    }

    checkPremium();

    // Check if user just returned from Stripe
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscribed') === '1') {
        let attempts = 0;
        const interval = setInterval(async () => {
          const { data } = await supabase
            .from('profiles')
            .select('is_premium')
            .eq('id', session!.user.id)
            .single();
          if (data?.is_premium) {
            setIsPremium(true);
            clearInterval(interval);
            window.history.replaceState({}, '', window.location.pathname);
          }
          if (++attempts >= 10) clearInterval(interval);
        }, 2000);
      }
    }
  }, [session?.user.id]);

  async function purchaseWeb(plan: 'monthly' | 'annual') {
    if (!session?.user.id) throw new Error('Not logged in');
    await stripeCheckout(plan, session.user.id);
  }

  return (
    <PurchaseContext.Provider value={{ isPremium, loading, purchaseWeb }}>
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error('usePurchase must be used within PurchaseProvider');
  return ctx;
}
