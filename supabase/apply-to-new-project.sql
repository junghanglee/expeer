
-- ============================================================
-- Migration: 20260428055920_e3183e6d-e3f2-4df4-9ce7-cfe6cc7a44f1.sql
-- ============================================================

-- Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  nickname TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- RLS: profiles
CREATE POLICY "Profiles are viewable by owner"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS: user_roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Migration: 20260428055939_f5648f64-c8ec-4cff-8907-ccd1cf880125.sql
-- ============================================================

-- set_updated_at: add search_path
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Restrict has_role and handle_new_user execution
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Migration: 20260428061952_da5ee1e4-2ea0-488d-941c-98e04d8732b4.sql
-- ============================================================


-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.kyc_status AS ENUM ('none', 'pending', 'approved', 'rejected');
CREATE TYPE public.ad_side AS ENUM ('buy', 'sell');
CREATE TYPE public.ad_status AS ENUM ('active', 'paused', 'completed', 'cancelled');
CREATE TYPE public.order_status AS ENUM (
  'created',          -- 주문 생성, 상대방 정보 공유 대기
  'info_shared',      -- 양측 정보 공유 완료, 입금 대기
  'paid',             -- 구매자가 입금 완료 표시
  'proof_uploaded',   -- 입금 증빙 업로드됨
  'confirmed',        -- 판매자가 입금 확인
  'released',         -- 코인 송금 완료
  'completed',        -- 거래 완료 (양측 확인)
  'cancelled',
  'disputed',
  'expired'
);
CREATE TYPE public.message_type AS ENUM ('text', 'image', 'system', 'proof', 'transfer');
CREATE TYPE public.dispute_status AS ENUM ('open', 'reviewing', 'resolved_buyer', 'resolved_seller', 'closed');
CREATE TYPE public.notification_type AS ENUM ('order', 'message', 'dispute', 'kyc', 'system');

-- =========================
-- PROFILES 확장
-- =========================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS kyc_status public.kyc_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS kyc_level INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trade_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;

-- =========================
-- BANK ACCOUNTS
-- =========================
CREATE TABLE public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_holder TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_bank_accounts_user ON public.bank_accounts(user_id);
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own bank accounts" ON public.bank_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all bank accounts" ON public.bank_accounts
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- WALLETS
-- =========================
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  asset TEXT NOT NULL,            -- e.g. 'USDT', 'BTC'
  network TEXT NOT NULL,          -- e.g. 'TRC20', 'ERC20'
  address TEXT NOT NULL,
  label TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_wallets_user ON public.wallets(user_id);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own wallets" ON public.wallets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all wallets" ON public.wallets
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- KYC SUBMISSIONS
-- =========================
CREATE TABLE public.kyc_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  id_number TEXT NOT NULL,
  id_type TEXT NOT NULL,           -- 'rrn', 'passport' 등
  id_front_url TEXT,
  id_back_url TEXT,
  selfie_url TEXT,
  status public.kyc_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES auth.users(id),
  reviewer_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_kyc_user ON public.kyc_submissions(user_id);
CREATE INDEX idx_kyc_status ON public.kyc_submissions(status);
ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own kyc" ON public.kyc_submissions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users insert own kyc" ON public.kyc_submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view all kyc" ON public.kyc_submissions
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update kyc" ON public.kyc_submissions
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- ADS (광고)
-- =========================
CREATE TABLE public.ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  side public.ad_side NOT NULL,      -- buy = 광고주가 구매, sell = 광고주가 판매
  asset TEXT NOT NULL,                -- 'USDT' 등
  network TEXT NOT NULL,
  fiat TEXT NOT NULL DEFAULT 'KRW',
  price NUMERIC(20,8) NOT NULL,       -- 단가 (fiat per asset)
  total_amount NUMERIC(20,8) NOT NULL,
  available_amount NUMERIC(20,8) NOT NULL,
  min_order NUMERIC(20,8) NOT NULL,
  max_order NUMERIC(20,8) NOT NULL,
  payment_methods TEXT[] NOT NULL DEFAULT ARRAY['bank_transfer'],
  terms TEXT,
  status public.ad_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ads_user ON public.ads(user_id);
CREATE INDEX idx_ads_status_side ON public.ads(status, side);
CREATE INDEX idx_ads_asset ON public.ads(asset);
ALTER TABLE public.ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active ads viewable by all" ON public.ads
  FOR SELECT USING (status = 'active' OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users manage own ads" ON public.ads
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage all ads" ON public.ads
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- ORDERS (거래 주문)
-- =========================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_id UUID NOT NULL REFERENCES public.ads(id) ON DELETE RESTRICT,
  buyer_id UUID NOT NULL REFERENCES auth.users(id),
  seller_id UUID NOT NULL REFERENCES auth.users(id),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  fiat TEXT NOT NULL,
  price NUMERIC(20,8) NOT NULL,
  amount NUMERIC(20,8) NOT NULL,        -- 코인 수량
  fiat_amount NUMERIC(20,2) NOT NULL,   -- 원화 금액
  status public.order_status NOT NULL DEFAULT 'created',
  buyer_bank_account_id UUID REFERENCES public.bank_accounts(id),
  seller_bank_account_id UUID REFERENCES public.bank_accounts(id),
  buyer_wallet_id UUID REFERENCES public.wallets(id),
  expires_at TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_buyer ON public.orders(buyer_id);
CREATE INDEX idx_orders_seller ON public.orders(seller_id);
CREATE INDEX idx_orders_ad ON public.orders(ad_id);
CREATE INDEX idx_orders_status ON public.orders(status);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order parties view" ON public.orders
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Buyers create orders" ON public.orders
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Order parties update" ON public.orders
  FOR UPDATE USING (auth.uid() = buyer_id OR auth.uid() = seller_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete orders" ON public.orders
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- MESSAGES (주문별 채팅)
-- =========================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES auth.users(id),       -- NULL = system
  type public.message_type NOT NULL DEFAULT 'text',
  content TEXT,
  attachment_url TEXT,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_order ON public.messages(order_id, created_at);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order parties view messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id OR public.has_role(auth.uid(), 'admin'))
    )
  );
CREATE POLICY "Order parties send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
    )
  );

-- =========================
-- PAYMENT PROOFS
-- =========================
CREATE TABLE public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  image_url TEXT NOT NULL,
  amount NUMERIC(20,2),
  note TEXT,
  confirmed_by UUID REFERENCES auth.users(id),
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_proofs_order ON public.payment_proofs(order_id);
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order parties view proofs" ON public.payment_proofs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Buyers upload proofs" ON public.payment_proofs
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by AND
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND auth.uid() = o.buyer_id)
  );
CREATE POLICY "Sellers confirm proofs" ON public.payment_proofs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND auth.uid() = o.seller_id)
  );

-- =========================
-- TRANSFERS (코인 송금)
-- =========================
CREATE TABLE public.transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  asset TEXT NOT NULL,
  network TEXT NOT NULL,
  amount NUMERIC(20,8) NOT NULL,
  to_address TEXT NOT NULL,
  tx_hash TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_transfers_order ON public.transfers(order_id);
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order parties view transfers" ON public.transfers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Sellers create transfers" ON public.transfers
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND auth.uid() = o.seller_id)
  );

-- =========================
-- DISPUTES
-- =========================
CREATE TABLE public.disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  opener_id UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  description TEXT,
  evidence_urls TEXT[],
  status public.dispute_status NOT NULL DEFAULT 'open',
  resolver_id UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_disputes_order ON public.disputes(order_id);
CREATE INDEX idx_disputes_status ON public.disputes(status);
ALTER TABLE public.disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order parties view disputes" ON public.disputes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id OR public.has_role(auth.uid(), 'admin')))
  );
CREATE POLICY "Order parties open disputes" ON public.disputes
  FOR INSERT WITH CHECK (
    auth.uid() = opener_id AND
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id))
  );
CREATE POLICY "Admins manage disputes" ON public.disputes
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- =========================
-- REVIEWS
-- =========================
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id),
  reviewee_id UUID NOT NULL REFERENCES auth.users(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(order_id, reviewer_id)
);
CREATE INDEX idx_reviews_reviewee ON public.reviews(reviewee_id);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reviews viewable by all" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users write reviews on own orders" ON public.reviews
  FOR INSERT WITH CHECK (
    auth.uid() = reviewer_id AND
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id
      AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
      AND o.status = 'completed')
  );

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  link TEXT,
  metadata JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System inserts notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

-- =========================
-- updated_at 자동 갱신 트리거
-- =========================
CREATE TRIGGER trg_bank_accounts_updated BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_wallets_updated BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_kyc_updated BEFORE UPDATE ON public.kyc_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ads_updated BEFORE UPDATE ON public.ads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_disputes_updated BEFORE UPDATE ON public.disputes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================
-- 신규 사용자 생성 트리거 (기존 함수 활용)
-- =========================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- 거래 완료 시 trade_count 증가
-- =========================
CREATE OR REPLACE FUNCTION public.bump_trade_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.profiles SET trade_count = trade_count + 1 WHERE id = NEW.buyer_id;
    UPDATE public.profiles SET trade_count = trade_count + 1 WHERE id = NEW.seller_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_orders_trade_count AFTER UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.bump_trade_count();

-- =========================
-- REALTIME 활성화
-- =========================
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.orders REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;


-- ============================================================
-- Migration: 20260428062014_9f69ca65-bf95-46df-b5de-a83e2866a192.sql
-- ============================================================


-- 1. notifications INSERT 정책 강화
DROP POLICY IF EXISTS "System inserts notifications" ON public.notifications;
CREATE POLICY "Users insert own notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- 2. SECURITY DEFINER 함수 실행 권한 회수
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.bump_trade_count() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

-- has_role은 RLS 정책에서 호출되므로 authenticated에는 허용
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;


-- ============================================================
-- Migration: 20260428064310_ea59c3e6-4b01-4662-89af-019864667636.sql
-- ============================================================

-- KYC documents bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Payment proofs bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- KYC: users can upload to their own folder
CREATE POLICY "Users upload own kyc files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users view own kyc files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kyc-documents'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Users update own kyc files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own kyc files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'kyc-documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Payment proofs: buyer uploads to their folder, parties + admin can view
CREATE POLICY "Buyers upload own payment proofs"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Order parties view payment proofs"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'payment-proofs'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.payment_proofs pp
      JOIN public.orders o ON o.id = pp.order_id
      WHERE pp.image_url LIKE '%' || storage.objects.name
        AND (auth.uid() = o.buyer_id OR auth.uid() = o.seller_id)
    )
  )
);

CREATE POLICY "Buyers delete own payment proofs"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'payment-proofs'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- ============================================================
-- Migration: 20260428075658_874e637d-b93b-4126-a683-cd3b156370c0.sql
-- ============================================================

ALTER TABLE public.messages REPLICA IDENTITY FULL;
CREATE INDEX IF NOT EXISTS idx_messages_order_created ON public.messages(order_id, created_at);

-- ============================================================
-- Migration: 20260428080835_135ca58b-64cf-4de3-b6dc-480593da1baf.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260428080852_b0aaa263-9139-46e7-bf15-b92a43f515c1.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260428080917_e5158ecc-6233-494d-868c-40bbf8d17a65.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_trade_count() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Migration: 20260428080931_303efa12-4066-4e22-8833-012f5b082f5b.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Migration: 20260428081726_4b8e2fe6-4a96-4948-9bc4-4536d6b95805.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260428083232_c490f6b9-24be-4ef4-8dc6-c50ba414a7d6.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260428083247_8c9dddef-83d8-4632-a5a1-cf7f14db8c22.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.notify_on_order_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_order_status() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_payment_proof() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_transfer() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_dispute() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_on_review() FROM PUBLIC, anon, authenticated;

-- ============================================================
-- Migration: 20260428094107_c13fb116-3717-4e11-8653-3313af32d1ad.sql
-- ============================================================

-- transfers.tx_hash unique
CREATE UNIQUE INDEX IF NOT EXISTS transfers_tx_hash_key
ON public.transfers (tx_hash)
WHERE tx_hash IS NOT NULL;

-- orders 에스크로 컬럼
DO $$ BEGIN
  CREATE TYPE public.escrow_status AS ENUM ('none','locked','released','refunded','disputed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_contract_address text,
  ADD COLUMN IF NOT EXISTS escrow_order_id text,
  ADD COLUMN IF NOT EXISTS escrow_lock_tx_hash text,
  ADD COLUMN IF NOT EXISTS escrow_release_tx_hash text,
  ADD COLUMN IF NOT EXISTS escrow_status public.escrow_status NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS chain text;

-- ============================================================
-- Migration: 20260429171343_1a771d65-421a-4eb7-b7e0-5324b0cc2a02.sql
-- ============================================================

-- 1. ad_kind enum
DO $$ BEGIN
  CREATE TYPE public.ad_kind AS ENUM ('fiat', 'crypto_swap');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Extend ads table
ALTER TABLE public.ads
  ADD COLUMN IF NOT EXISTS kind public.ad_kind NOT NULL DEFAULT 'fiat',
  ADD COLUMN IF NOT EXISTS is_market boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS filled_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expected_fill_sec integer,
  ADD COLUMN IF NOT EXISTS to_asset text,
  ADD COLUMN IF NOT EXISTS to_network text,
  ADD COLUMN IF NOT EXISTS to_amount numeric,
  ADD COLUMN IF NOT EXISTS premium_pct numeric;

-- 3. fiat becomes nullable (crypto_swap doesn't use it)
ALTER TABLE public.ads ALTER COLUMN fiat DROP NOT NULL;

-- 4. Helpful indexes
CREATE INDEX IF NOT EXISTS idx_ads_kind_status ON public.ads (kind, status);
CREATE INDEX IF NOT EXISTS idx_ads_asset ON public.ads (asset);
CREATE INDEX IF NOT EXISTS idx_ads_to_asset ON public.ads (to_asset);

-- ============================================================
-- Migration: 20260429173953_dddcde9d-1721-4c85-be07-27871f4dbddd.sql
-- ============================================================

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

-- ============================================================
-- Migration: 20260429175242_4ab270df-5c27-4f7c-a4ad-241eb3c49a45.sql
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.ads;

-- ============================================================
-- Migration: 20260429180437_4a9b6290-7274-4f37-be91-f3473bbf3b06.sql
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ads'
      AND policyname = 'Authenticated users can create own ads'
  ) THEN
    CREATE POLICY "Authenticated users can create own ads"
    ON public.ads
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================
-- Migration: 20260506061414_6e321206-7417-4a88-bd85-2d861604de44.sql
-- ============================================================


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


-- ============================================================
-- Migration: 20260506061429_7bb37d2a-415e-42a2-a646-b39d1b5b9a88.sql
-- ============================================================


REVOKE EXECUTE ON FUNCTION public.validate_order_update() FROM PUBLIC, anon, authenticated;


-- ============================================================
-- Migration: 20260506062502_fbb54fa1-3d02-4b12-9dac-270d0818a309.sql
-- ============================================================

-- Auto-grant admin role to super admin email admin@expeer.art
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, nickname)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nickname', split_part(NEW.email, '@', 1))
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  IF lower(NEW.email) = 'admin@expeer.art' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;

-- Promote existing admin@expeer.art account if it already exists
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE lower(email) = 'admin@expeer.art'
ON CONFLICT (user_id, role) DO NOTHING;

-- ============================================================
-- Migration: 20260506065310_f149009a-c3f3-4ba1-a5dc-33438892572b.sql
-- ============================================================

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.validate_order_update() TO authenticated, anon;

-- ============================================================
-- Migration: 20260512103044_c6a6afd5-1664-40cd-b26c-8aae60f38816.sql
-- ============================================================


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


-- ============================================================
-- Migration: 20260512103828_d2027f4f-f55a-4875-ba1a-1f26124d0601.sql
-- ============================================================


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


-- ============================================================
-- Migration: 20260512105427_353bac10-e54f-493e-b614-4f139df75c8e.sql
-- ============================================================


ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS escrow_order_id_hash text,
  ADD COLUMN IF NOT EXISTS payment_metadata jsonb;

CREATE INDEX IF NOT EXISTS idx_orders_escrow_id_hash
  ON public.orders (escrow_order_id_hash) WHERE escrow_order_id_hash IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS real_name text;


-- ============================================================
-- Migration: 20260512105550_0e119b9b-2d80-49c2-bb45-f32ade138ac1.sql
-- ============================================================


CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

