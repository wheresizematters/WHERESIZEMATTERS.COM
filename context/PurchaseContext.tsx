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
        let attempts = 0;
        const API = getApiUrl();
        const interval = setInterval(async () => {
          const token = getToken();
          if (!token) return;
          const res = await fetch(`${API}/api/v1/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.is_premium) {
              setIsPremium(true);
              clearInterval(interval);
              window.history.replaceState({}, '', window.location.pathname);
            }
          }
          if (++attempts >= 10) clearInterval(interval);
        }, 2000);
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
