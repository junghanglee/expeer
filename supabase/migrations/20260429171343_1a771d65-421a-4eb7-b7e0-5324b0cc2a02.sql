-- 1. ad_kind enum
DO $$ BEGIN
  CREATE TYPE public.ad_kind AS ENUM ('fiat', 'crypto_swap');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend ads table
ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS kind public.ad_kind NOT NULL DEFAULT 'fiat',
  ADD COLUMN IF NOT EXISTS is_market boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS filled_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_fill_sec integer,
  ADD COLUMN IF NOT EXISTS to_asset text,
  ADD COLUMN IF NOT EXISTS to_network text,
  ADD COLUMN IF NOT EXISTS to_amount numeric,
  ADD COLUMN IF NOT EXISTS premium_pct numeric;

-- 3. fiat becomes nullable (crypto_swap doesn't use it)
ALTER TABLE public.ads ALTER COLUMN fiat DROP NOT NULL;

-- 4. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_ads_kind_status ON public.ads (kind, status);
CREATE INDEX IF NOT EXISTS idx_ads_asset ON public.ads (asset);
CREATE INDEX IF NOT EXISTS idx_ads_to_asset ON public.ads (to_asset);