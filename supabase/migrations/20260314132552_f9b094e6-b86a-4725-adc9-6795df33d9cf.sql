INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read access for email assets" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'email-assets');

CREATE POLICY "Authenticated upload email assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'email-assets');