
-- 1) 기본 KYC 한도 정책 시드
INSERT INTO public.app_settings (key, value)
VALUES (
  'kyc_limits',
  '{
    "0": {"per_order_krw": 100000,    "daily_krw": 200000,    "monthly_krw": 500000,    "label": "미인증"},
    "1": {"per_order_krw": 1000000,   "daily_krw": 2000000,   "monthly_krw": 10000000,  "label": "휴대폰 인증"},
    "2": {"per_order_krw": 5000000,   "daily_krw": 10000000,  "monthly_krw": 50000000,  "label": "신분증 인증"},
    "3": {"per_order_krw": 50000000,  "daily_krw": 100000000, "monthly_krw": 500000000, "label": "고급 인증"}
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- 2) KYC 상태 변경 시 profiles 동기화 트리거
CREATE OR REPLACE FUNCTION public.sync_profile_on_kyc_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'approved' THEN
      UPDATE public.profiles
      SET kyc_status = 'approved',
          kyc_level = GREATEST(kyc_level, 2)
      WHERE id = NEW.user_id;

      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'kyc', 'KYC 승인 완료', '신분증 인증이 승인되었습니다. 한도가 상향되었습니다.', '/app/profile');

    ELSIF NEW.status = 'rejected' THEN
      UPDATE public.profiles
      SET kyc_status = 'rejected'
      WHERE id = NEW.user_id;

      INSERT INTO public.notifications (user_id, type, title, body, link)
      VALUES (NEW.user_id, 'kyc', 'KYC 거절', COALESCE(NEW.reviewer_note, '신분증 인증이 거절되었습니다. 사유를 확인해주세요.'), '/onboarding/kyc');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_profile_on_kyc_review ON public.kyc_submissions;
CREATE TRIGGER trg_sync_profile_on_kyc_review
  AFTER UPDATE ON public.kyc_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_profile_on_kyc_review();

GRANT EXECUTE ON FUNCTION public.sync_profile_on_kyc_review() TO authenticated, anon;

-- 3) 사용자의 최근 거래량 합계 (KRW 기준)
CREATE OR REPLACE FUNCTION public.get_user_trade_volume(_user_id uuid, _since timestamptz)
RETURNS numeric
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(fiat_amount), 0)::numeric
  FROM public.orders
  WHERE (buyer_id = _user_id OR seller_id = _user_id)
    AND status NOT IN ('cancelled')
    AND created_at >= _since;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_trade_volume(uuid, timestamptz) TO authenticated, anon;
