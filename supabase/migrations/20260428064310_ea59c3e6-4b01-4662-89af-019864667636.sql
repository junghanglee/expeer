-- KYC documents bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Payment proofs bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- KYC: users can upload to their own folder
CREATE POLICY "Users upload own kyc files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users view own kyc files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users update own kyc files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own kyc files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Payment proofs: buyer uploads to their folder, parties + admin can view
CREATE POLICY "Buyers upload own payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Order parties view payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.payment_proofs pp
      JOIN public.orders o ON o.id = pp.order_id
      WHERE pp.image_url LIKE '%' || storage.objects.name
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
    )
  )
);

CREATE POLICY "Buyers delete own payment proofs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);