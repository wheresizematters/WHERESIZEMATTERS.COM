-- X (Twitter) identity columns for profile verification
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS x_handle text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS x_avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS x_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS x_verified boolean DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_provider text;

-- Index for looking up profiles by X handle
CREATE INDEX IF NOT EXISTS idx_profiles_x_handle ON public.profiles (x_handle)
  WHERE x_handle IS NOT NULL;
