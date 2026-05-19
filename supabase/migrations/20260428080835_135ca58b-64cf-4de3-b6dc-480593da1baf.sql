-- 1) orders에 취소 합의 필드 추가
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS seller_cancel_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text;

-- 2) 양측 합의 시 자동 cancelled 처리하는 트리거 함수
CREATE OR REPLACE FUNCTION public.auto_cancel_on_mutual_agreement()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS trg_auto_cancel ON public.orders;
CREATE TRIGGER trg_auto_cancel
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cancel_on_mutual_agreement();

-- 3) evidence_packages 발급 로그 테이블
CREATE TABLE IF NOT EXISTS public.evidence_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  dispute_id uuid,
  requested_by uuid NOT NULL,
  file_size_bytes bigint,
  item_counts jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_packages_order ON public.evidence_packages(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_evidence_packages_user ON public.evidence_packages(requested_by, created_at DESC);

ALTER TABLE public.evidence_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order parties view evidence logs"
  ON public.evidence_packages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = evidence_packages.order_id
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id OR public.has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Order parties insert evidence logs"
  ON public.evidence_packages
  FOR INSERT
  WITH CHECK (
    auth.uid() = requested_by
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = evidence_packages.order_id
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
    )
  );

CREATE POLICY "Admins manage evidence logs"
  ON public.evidence_packages
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));