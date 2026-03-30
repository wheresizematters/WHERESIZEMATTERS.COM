import React, { createContext, useContext } from 'react';

interface PurchaseContextType {
  isPremium: boolean;
  loading: boolean;
  purchaseWeb: (plan: 'monthly' | 'annual') => Promise<void>;
}

const PurchaseContext = createContext<PurchaseContextType | null>(null);

export function PurchaseProvider({ children }: { children: React.ReactNode }) {
  // Premium is free for everyone — no paywall, no Stripe
  return (
    <PurchaseContext.Provider value={{ isPremium: true, loading: false, purchaseWeb: async () => {} }}>
      {children}
    </PurchaseContext.Provider>
  );
}

export function usePurchase() {
  const ctx = useContext(PurchaseContext);
  if (!ctx) throw new Error('usePurchase must be used within PurchaseProvider');
  return ctx;
}
