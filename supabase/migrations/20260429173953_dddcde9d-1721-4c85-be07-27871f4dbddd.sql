-- 1) app_settings 테이블
CREATE TABLE IF NOT EXISTS public.app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "App settings readable by all"
  ON public.app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins manage app settings"
  ON public.app_settings FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_app_settings_updated
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2) 기본 수수료 시드 (1%)
INSERT INTO public.app_settings (key, value)
VALUES ('fees', jsonb_build_object('buyer_pct', 1.0, 'seller_pct', 1.0))
ON CONFLICT (key) DO NOTHING;

-- 3) orders에 수수료 스냅샷 컬럼 추가
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS buyer_fee_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_fee_pct numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS buyer_fee_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_fee_amount numeric NOT NULL DEFAULT 0;