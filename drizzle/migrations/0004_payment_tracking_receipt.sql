ALTER TABLE public.member_payments ADD COLUMN IF NOT EXISTS tracking_code text;
ALTER TABLE public.member_payments ADD COLUMN IF NOT EXISTS receipt_url text;
CREATE POLICY "receipts read" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'receipts');
CREATE POLICY "receipts insert" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'receipts');
CREATE POLICY "receipts update" ON storage.objects FOR UPDATE TO anon, authenticated USING (bucket_id = 'receipts');