
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
