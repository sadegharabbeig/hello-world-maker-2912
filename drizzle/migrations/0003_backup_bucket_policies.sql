CREATE POLICY "backups open read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'backups');
CREATE POLICY "backups open insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'backups');
CREATE POLICY "backups open update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'backups') WITH CHECK (bucket_id = 'backups');