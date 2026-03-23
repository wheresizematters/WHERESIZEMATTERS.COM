-- Add girth_inches column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS girth_inches decimal(4,2);

-- Update handle_new_user trigger to also save girth from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, size_inches, has_set_size, age_range, girth_inches)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE((new.raw_user_meta_data->>'size_inches')::decimal, 6.0),
    (new.raw_user_meta_data->>'size_inches') IS NOT NULL,
    new.raw_user_meta_data->>'age_range',
    NULLIF(new.raw_user_meta_data->>'girth_inches', '')::decimal
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;
