-- Add rich profile fields
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS header_url text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website text;

-- Storage buckets for avatars and headers
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('headers', 'headers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own avatar/header
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can upload their own header"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'headers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Anyone can view headers"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'headers');

CREATE POLICY "Users can update their own header"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'headers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own header"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'headers' AND auth.uid()::text = (storage.foldername(name))[1]);
