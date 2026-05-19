
-- 1) Add price snapshot + lifecycle columns (idempotent)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS price_snapshot_krw numeric,
  ADD COLUMN IF NOT EXISTS price_source text,
  ADD COLUMN IF NOT EXISTS price_snapshot_at timestamptz;

-- 2) Indexes for hot paths
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON public.orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON public.orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_expires_at ON public.orders(expires_at);
CREATE INDEX IF NOT EXISTS idx_ads_active_lookup ON public.ads(status, side, asset, network);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_messages_order_created ON public.messages(order_id, created_at);

-- 3) Strengthen state machine: include escrow transitions
CREATE OR REPLACE FUNCTION public.validate_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_is_admin boolean := public.has_role(v_uid, 'admin'::app_role);
  v_is_buyer boolean := (v_uid = OLD.buyer_id);
  v_is_seller boolean := (v_uid = OLD.seller_id);
BEGIN
  -- Admin or service role bypass
  IF v_is_admin OR v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  -- Immutable identity / financial columns
  IF NEW.id <> OLD.id
     OR NEW.ad_id IS DISTINCT FROM OLD.ad_id
     OR NEW.buyer_id IS DISTINCT FROM OLD.buyer_id
     OR NEW.seller_id IS DISTINCT FROM OLD.seller_id
     OR NEW.asset IS DISTINCT FROM OLD.asset
     OR NEW.network IS DISTINCT FROM OLD.network
     OR NEW.fiat IS DISTINCT FROM OLD.fiat
     OR NEW.price IS DISTINCT FROM OLD.price
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.fiat_amount IS DISTINCT FROM OLD.fiat_amount
     OR NEW.buyer_fee_pct IS DISTINCT FROM OLD.buyer_fee_pct
     OR NEW.seller_fee_pct IS DISTINCT FROM OLD.seller_fee_pct
     OR NEW.buyer_fee_amount IS DISTINCT FROM OLD.buyer_fee_amount
     OR NEW.seller_fee_amount IS DISTINCT FROM OLD.seller_fee_amount
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.price_snapshot_krw IS DISTINCT FROM OLD.price_snapshot_krw
     OR NEW.price_source IS DISTINCT FROM OLD.price_source
     OR NEW.price_snapshot_at IS DISTINCT FROM OLD.price_snapshot_at
  THEN
    RAISE EXCEPTION 'Immutable order field modification denied';
  END IF;

  -- Status transition state machine (only when status changes)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF v_is_buyer AND OLD.status = 'created' AND NEW.status IN ('paid','cancelled') THEN NULL;
    ELSIF v_is_buyer AND OLD.status = 'paid' AND NEW.status = 'proof_uploaded' THEN NULL;
    ELSIF v_is_buyer AND OLD.status = 'info_shared' AND NEW.status IN ('paid','cancelled') THEN NULL;
    ELSIF v_is_seller AND OLD.status = 'created' AND NEW.status IN ('info_shared','cancelled') THEN NULL;
    ELSIF v_is_seller AND OLD.status IN ('paid','proof_uploaded') AND NEW.status = 'confirmed' THEN NULL;
    ELSIF v_is_seller AND OLD.status = 'confirmed' AND NEW.status IN ('released','completed') THEN NULL;
    ELSIF v_is_seller AND OLD.status = 'released' AND NEW.status = 'completed' THEN NULL;
    ELSIF (v_is_buyer OR v_is_seller) AND NEW.status = 'disputed' AND OLD.status NOT IN ('completed','cancelled') THEN NULL;
    ELSIF (v_is_buyer OR v_is_seller) AND NEW.status = 'cancelled' THEN
      IF OLD.status IN ('created','info_shared') THEN NULL;
      ELSE
        RAISE EXCEPTION 'Invalid status transition % -> %', OLD.status, NEW.status;
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid status transition % -> % for role', OLD.status, NEW.status;
    END IF;
  END IF;

  -- Escrow status transition validation
  IF NEW.escrow_status IS DISTINCT FROM OLD.escrow_status THEN
    IF v_is_seller AND OLD.escrow_status = 'none' AND NEW.escrow_status = 'locked' THEN NULL;
    ELSIF v_is_seller AND OLD.escrow_status = 'locked' AND NEW.escrow_status IN ('released','refunded','disputed') THEN NULL;
    ELSIF (v_is_buyer OR v_is_seller) AND OLD.escrow_status = 'locked' AND NEW.escrow_status = 'disputed' THEN NULL;
    ELSE
      RAISE EXCEPTION 'Invalid escrow_status transition % -> %', OLD.escrow_status, NEW.escrow_status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_order_update() TO authenticated, anon;

-- 4) Ensure trigger is attached (recreate to guarantee state)
DROP TRIGGER IF EXISTS trg_validate_order_update ON public.orders;
CREATE TRIGGER trg_validate_order_update
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_update();

-- 5) Ensure mutual cancel + notify triggers are attached
DROP TRIGGER IF EXISTS trg_auto_cancel_on_mutual_agreement ON public.orders;
CREATE TRIGGER trg_auto_cancel_on_mutual_agreement
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cancel_on_mutual_agreement();

DROP TRIGGER IF EXISTS trg_notify_on_order_status ON public.orders;
CREATE TRIGGER trg_notify_on_order_status
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_order_status();

DROP TRIGGER IF EXISTS trg_notify_on_order_created ON public.orders;
CREATE TRIGGER trg_notify_on_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_order_created();

DROP TRIGGER IF EXISTS trg_bump_trade_count ON public.orders;
CREATE TRIGGER trg_bump_trade_count
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_trade_count();
