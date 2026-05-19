CREATE OR REPLACE FUNCTION public.notify_on_order_created()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (NEW.seller_id, 'order', '새 주문이 들어왔습니다',
    NEW.asset || ' ' || NEW.amount || ' / ' || NEW.fiat_amount || ' ' || NEW.fiat,
    '/app/order/' || NEW.id,
    jsonb_build_object('order_id', NEW.id, 'event', 'created'));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_order_created ON public.orders;
CREATE TRIGGER trg_notify_order_created AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_created();

CREATE OR REPLACE FUNCTION public.notify_on_order_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_title text; v_body text; v_to_buyer boolean := false; v_to_seller boolean := false;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'paid' THEN
      v_title := '입금이 확인되었습니다'; v_body := '판매자가 자산을 송금할 차례입니다';
      v_to_buyer := true; v_to_seller := true;
    ELSIF NEW.status = 'released' THEN
      v_title := '자산이 송금되었습니다'; v_body := '판매자가 자산을 송금했습니다. 수령을 확인해주세요';
      v_to_buyer := true;
    ELSIF NEW.status = 'completed' THEN
      v_title := '거래가 완료되었습니다'; v_body := '평가를 남겨주세요';
      v_to_buyer := true; v_to_seller := true;
    ELSIF NEW.status = 'cancelled' THEN
      v_title := '주문이 취소되었습니다'; v_body := COALESCE(NEW.cancel_reason, '주문이 취소되었습니다');
      v_to_buyer := true; v_to_seller := true;
    END IF;
    IF v_to_buyer THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (NEW.buyer_id, 'order', v_title, v_body, '/app/order/' || NEW.id,
              jsonb_build_object('order_id', NEW.id, 'event', NEW.status));
    END IF;
    IF v_to_seller THEN
      INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
      VALUES (NEW.seller_id, 'order', v_title, v_body, '/app/order/' || NEW.id,
              jsonb_build_object('order_id', NEW.id, 'event', NEW.status));
    END IF;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_order_status ON public.orders;
CREATE TRIGGER trg_notify_order_status AFTER UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.notify_on_order_status();

CREATE OR REPLACE FUNCTION public.notify_on_payment_proof()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_seller uuid; v_order uuid;
BEGIN
  SELECT seller_id, id INTO v_seller, v_order FROM public.orders WHERE id = NEW.order_id;
  IF v_seller IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (v_seller, 'payment', '입금 증빙이 업로드되었습니다',
            '구매자가 입금 증빙을 업로드했습니다. 확인해주세요',
            '/app/order/' || v_order,
            jsonb_build_object('order_id', v_order, 'proof_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_payment_proof ON public.payment_proofs;
CREATE TRIGGER trg_notify_payment_proof AFTER INSERT ON public.payment_proofs
FOR EACH ROW EXECUTE FUNCTION public.notify_on_payment_proof();

CREATE OR REPLACE FUNCTION public.notify_on_transfer()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_buyer uuid; v_order uuid;
BEGIN
  SELECT buyer_id, id INTO v_buyer, v_order FROM public.orders WHERE id = NEW.order_id;
  IF v_buyer IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (v_buyer, 'transfer', '판매자가 자산을 보냈습니다',
            NEW.amount || ' ' || NEW.asset || ' (' || NEW.network || ')',
            '/app/order/' || v_order,
            jsonb_build_object('order_id', v_order, 'transfer_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_transfer ON public.transfers;
CREATE TRIGGER trg_notify_transfer AFTER INSERT ON public.transfers
FOR EACH ROW EXECUTE FUNCTION public.notify_on_transfer();

CREATE OR REPLACE FUNCTION public.notify_on_dispute()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_buyer uuid; v_seller uuid; v_other uuid;
BEGIN
  SELECT buyer_id, seller_id INTO v_buyer, v_seller FROM public.orders WHERE id = NEW.order_id;
  IF NEW.opener_id = v_buyer THEN v_other := v_seller; ELSE v_other := v_buyer; END IF;
  IF v_other IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
    VALUES (v_other, 'dispute', '분쟁이 접수되었습니다',
            COALESCE(NEW.reason, '상대방이 분쟁을 접수했습니다'),
            '/app/order/' || NEW.order_id || '/dispute',
            jsonb_build_object('order_id', NEW.order_id, 'dispute_id', NEW.id));
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_dispute ON public.disputes;
CREATE TRIGGER trg_notify_dispute AFTER INSERT ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.notify_on_dispute();

CREATE OR REPLACE FUNCTION public.notify_on_review()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link, metadata)
  VALUES (NEW.reviewee_id, 'review', '새 평가를 받았습니다',
          '평점 ' || NEW.rating || '점',
          '/app/profile',
          jsonb_build_object('order_id', NEW.order_id, 'review_id', NEW.id, 'rating', NEW.rating));
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_review ON public.reviews;
CREATE TRIGGER trg_notify_review AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION public.notify_on_review();