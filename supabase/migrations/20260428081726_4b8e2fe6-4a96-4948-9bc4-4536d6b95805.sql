CREATE OR REPLACE FUNCTION public.refresh_user_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  avg_rating numeric;
BEGIN
  SELECT COALESCE(AVG(rating)::numeric(3,2), 0) INTO avg_rating
  FROM public.reviews
  WHERE reviewee_id = NEW.reviewee_id;

  UPDATE public.profiles
  SET rating = avg_rating
  WHERE id = NEW.reviewee_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_user_rating ON public.reviews;
CREATE TRIGGER trg_refresh_user_rating
  AFTER INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_user_rating();