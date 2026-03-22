-- Add $SIZE coins balance to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS size_coins integer NOT NULL DEFAULT 0;
