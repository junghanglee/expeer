
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_order_id_hash text,
  ADD COLUMN IF NOT EXISTS payment_metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_escrow_id_hash
  ON public.orders (escrow_order_id_hash) WHERE escrow_order_id_hash IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS real_name text;
