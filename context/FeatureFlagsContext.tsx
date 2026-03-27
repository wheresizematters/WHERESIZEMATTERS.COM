import { createContext, useContext, useState, useEffect } from 'react';

interface FeatureFlags {
  staking: boolean;
  quickBuy: boolean;
  launchDickCoin: boolean;
  charting: boolean;
  circleJerks: boolean;
  discussions: boolean;
  media: boolean;
  verification: boolean;
  gifting: boolean;
  walletVerify: boolean;
  netWorthLeaderboard: boolean;
  cloutLeaderboard: boolean;
}

const defaults: FeatureFlags = {
  staking: true, quickBuy: true, launchDickCoin: true, charting: true,
  circleJerks: true, discussions: true, media: true, verification: true,
  gifting: true, walletVerify: true, netWorthLeaderboard: true, cloutLeaderboard: true,
};

const Ctx = createContext<FeatureFlags>(defaults);

export function FeatureFlagsProvider({ children }: { children: React.ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(defaults);

  useEffect(() => {
    function load() {
      fetch('/api/v1/analytics/features')
        .then(r => r.json())
        .then(d => setFlags({ ...defaults, ...d }))
        .catch(() => {});
    }
    load();
    const interval = setInterval(load, 300000); // 5 min
    return () => clearInterval(interval);
  }, []);

  return <Ctx.Provider value={flags}>{children}</Ctx.Provider>;
}

export function useFeatureFlags() { return useContext(Ctx); }
