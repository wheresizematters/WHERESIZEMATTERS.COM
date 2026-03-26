import React, { createContext, useContext, useEffect, useState } from 'react';
import { stripeCheckout } from '@/lib/purchases';
import { useAuth } from './AuthContext';
import { getToken, getApiUrl } from '@/lib/supabase';

interface PurchaseContextType {
  isPremium: boolean;
  loading: boolean;
  purchaseWeb: (plan: 'monthly' | 'annual') => Promise<void>;
}

const PurchaseContext = createContext<PurchaseContextType | null>(null);

export function PurchaseProvider({ children }: { children: React.ReactNode }) {
  const { session, profile } = useAuth();
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user.id) { setLoading(false); return; }
    setIsPremium(profile?.is_premium ?? false);
    setLoading(false);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('subscribed') === '1') {
        // User just returned from Stripe — grant premium immediately
        (async () => {
          try {
            await fetch('/api/v1/stripe/check-premium', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: session!.user.id }),
            });
            setIsPremium(true);
            window.history.replaceState({}, '', window.location.pathname);
            window.alert('Premium activated! Enjoy SIZE. Premium.');
          } catch {}
        })();
      }
    }
  }, [session?.user.id, profile?.is_premium]);

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
