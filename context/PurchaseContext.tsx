import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  initPurchases, getOfferings, purchasePackage,
  restorePurchases, isPremiumUser,
} from '@/lib/purchases';
import { useAuth } from './AuthContext';

interface PurchaseContextType {
  isPremium: boolean;
  offerings: any | null;
  customerInfo: any | null;
  loading: boolean;
  purchase: (pkg: any) => Promise<{ error: string | null }>;
  restore: () => Promise<{ error: string | null }>;
}

const PurchaseContext = createContext<PurchaseContextType | null>(null);

export function PurchaseProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<any | null>(null);
  const [offerings, setOfferings] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initPurchases(session?.user.id);
    getOfferings().then(setOfferings);
    setLoading(false);
  }, [session?.user.id]);

  async function purchase(pkg: any) {
    const { customerInfo, error } = await purchasePackage(pkg);
    if (customerInfo) setCustomerInfo(customerInfo);
    return { error };
  }

  async function restore() {
    const { customerInfo, error } = await restorePurchases();
    if (customerInfo) setCustomerInfo(customerInfo);
    return { error };
  }

  return (
    <PurchaseContext.Provider value={{
      isPremium: isPremiumUser(customerInfo),
      offerings,
      customerInfo,
      loading,
      purchase,
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
