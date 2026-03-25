-- Add wallet address column (referenced in code but never migrated)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS wallet_address text;

-- Staking tier cache (updated by indexer service)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staking_tier integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staking_amount numeric NOT NULL DEFAULT 0;

-- Index for indexer lookups by wallet
CREATE INDEX IF NOT EXISTS idx_profiles_wallet_address ON public.profiles (wallet_address)
  WHERE wallet_address IS NOT NULL;
