CREATE OR REPLACE FUNCTION public.auto_cancel_on_mutual_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.buyer_cancel_requested_at IS NOT NULL
     AND NEW.seller_cancel_requested_at IS NOT NULL
     AND NEW.status NOT IN ('cancelled', 'completed') THEN
    NEW.status := 'cancelled';
    NEW.cancelled_at := COALESCE(NEW.cancelled_at, now());
  END IF;
  RETURN NEW;
END;
$$;