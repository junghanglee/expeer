DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ads'
      AND policyname = 'Authenticated users can create own ads'
  ) THEN
    CREATE POLICY "Authenticated users can create own ads"
    ON public.ads
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;