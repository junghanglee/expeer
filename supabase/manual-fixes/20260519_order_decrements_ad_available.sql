-- Keep ad available_amount consistent when an order is created.
-- Client-side buyers cannot update seller-owned ads because of RLS, so this must run in the DB.
CREATE OR REPLACE FUNCTION public.decrement_ad_available_on_order_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ads
  SET
    available_amount = GREATEST(0, available_amount - NEW.amount),
    status = CASE
      WHEN GREATEST(0, available_amount - NEW.amount) <= 0 THEN 'paused'::public.ad_status
      ELSE status
    END,
    updated_at = now()
  WHERE id = NEW.ad_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_ad_available_on_order_created ON public.orders;
CREATE TRIGGER trg_decrement_ad_available_on_order_created
  AFTER INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_ad_available_on_order_created();
