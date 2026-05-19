-- transfers.tx_hash unique
CREATE UNIQUE INDEX IF NOT EXISTS transfers_tx_hash_key
ON public.transfers (tx_hash)
WHERE tx_hash IS NOT NULL;

-- orders 에스크로 컬럼
DO $$ BEGIN
  CREATE TYPE public.escrow_status AS ENUM ('none','locked','released','refunded','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_contract_address text,
  ADD COLUMN IF NOT EXISTS escrow_order_id text,
  ADD COLUMN IF NOT EXISTS escrow_lock_tx_hash text,
  ADD COLUMN IF NOT EXISTS escrow_release_tx_hash text,
  ADD COLUMN IF NOT EXISTS escrow_status public.escrow_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS chain text;