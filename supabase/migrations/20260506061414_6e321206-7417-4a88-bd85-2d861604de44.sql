
-- 1. Replace orders UPDATE policy with WITH CHECK that pins counterparty identity
DROP POLICY IF EXISTS "Order parties update" ON public.orders;
CREATE POLICY "Order parties update"
ON public.orders
FOR UPDATE
USING (
  (auth.uid() = buyer_id) OR (auth.uid() = seller_id) OR public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (auth.uid() = buyer_id) OR (auth.uid() = seller_id) OR public.has_role(auth.uid(), 'admin'::app_role)
);

-- 2. Trigger to enforce immutable financial fields + status state machine for non-admin updates
CREATE OR REPLACE FUNCTION public.validate_order_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  THEN
    RAISE EXCEPTION 'Immutable order field modification denied';
  END IF;

  -- Status transition state machine (only when status changes)
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    -- Allowed transitions per role
    IF v_is_buyer AND OLD.status = 'created' AND NEW.status IN ('paid','cancelled') THEN
      NULL;
    ELSIF v_is_buyer AND OLD.status = 'paid' AND NEW.status = 'proof_uploaded' THEN
      NULL;
    ELSIF v_is_buyer AND OLD.status = 'info_shared' AND NEW.status IN ('paid','cancelled') THEN
      NULL;
    ELSIF v_is_seller AND OLD.status = 'created' AND NEW.status IN ('info_shared','cancelled') THEN
      NULL;
    ELSIF v_is_seller AND OLD.status IN ('paid','proof_uploaded') AND NEW.status = 'confirmed' THEN
      NULL;
    ELSIF v_is_seller AND OLD.status = 'confirmed' AND NEW.status IN ('released','completed') THEN
      NULL;
    ELSIF v_is_seller AND OLD.status = 'released' AND NEW.status = 'completed' THEN
      NULL;
    ELSIF (v_is_buyer OR v_is_seller) AND NEW.status = 'disputed' AND OLD.status NOT IN ('completed','cancelled') THEN
      NULL;
    ELSIF (v_is_buyer OR v_is_seller) AND NEW.status = 'cancelled' THEN
      -- mutual cancel handled by auto_cancel trigger; allow only if pre-paid or via trigger context
      IF OLD.status IN ('created','info_shared') THEN NULL;
      ELSE
        RAISE EXCEPTION 'Invalid status transition % -> %', OLD.status, NEW.status;
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid status transition % -> % for role', OLD.status, NEW.status;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_order_update ON public.orders;
CREATE TRIGGER trg_validate_order_update
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_update();

-- Re-attach existing triggers ordering: ensure auto_cancel and notify still run
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

DROP TRIGGER IF EXISTS trg_bump_trade_count ON public.orders;
CREATE TRIGGER trg_bump_trade_count
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.bump_trade_count();

DROP TRIGGER IF EXISTS trg_notify_on_order_created ON public.orders;
CREATE TRIGGER trg_notify_on_order_created
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_on_order_created();

-- 3. Realtime authorization: require authenticated to subscribe to any channel
-- (postgres_changes broadcasts already respect RLS on the source tables; this
--  prevents anon access and unauthenticated channel listening)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='realtime' AND tablename='messages') THEN
    EXECUTE 'ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated can read realtime" ON realtime.messages';
    EXECUTE 'CREATE POLICY "Authenticated can read realtime" ON realtime.messages FOR SELECT TO authenticated USING (true)';
  END IF;
END $$;
