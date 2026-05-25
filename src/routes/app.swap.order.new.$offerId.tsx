import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { useCryptoSwaps } from "@/data/offerStore";
import { fmtNum } from "@/data/format";
import { useAuth } from "@/lib/auth";
import { useWallets } from "@/hooks/useWallets";
import { createOrder } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/swap/order/new/$offerId")({
  head: () => ({ meta: [{ title: "교환 주문 시작 — EXPEER" }] }),
  component: NewSwapOrder,
});

function NewSwapOrder() {
  const { offerId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wallets } = useWallets();
  const offers = useCryptoSwaps();
  const offer = offers.find((item) => item.id === offerId);
  const [submitting, setSubmitting] = useState(false);

  const fromWallets = useMemo(
    () => wallets.filter((wallet) => wallet.asset === offer?.fromAsset),
    [wallets, offer?.fromAsset],
  );
  const toWallets = useMemo(
    () => wallets.filter((wallet) => wallet.asset === offer?.toAsset),
    [wallets, offer?.toAsset],
  );
  const fromWallet = fromWallets[0];
  const toWallet = toWallets[0];

  if (!offer) {
    return (
      <PhoneShell hideTab>
        <AppHeader title="P2P교환 오퍼 없음" />
        <div className="px-5 py-8 text-center text-muted-foreground">
          존재하지 않거나 종료된 오퍼입니다.
        </div>
      </PhoneShell>
    );
  }

  const canStart = !!user && !offer.isMine && fromWallets.length > 0 && toWallets.length > 0;

  const start = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다.");
      return;
    }
    if (offer.isMine) {
      toast.error("내 오퍼에는 직접 참여할 수 없습니다.");
      return;
    }
    if (!fromWallet || !toWallet) {
      toast.error("보낼 지갑과 받을 지갑이 모두 필요합니다.");
      return;
    }
    if (!offer.ownerId) {
      toast.error("오퍼 소유자 정보를 확인할 수 없습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      const order = await createOrder(
        {
          ad_id: offer.id,
          buyer_id: user.id,
          seller_id: offer.ownerId,
          asset: offer.fromAsset,
          network: fromWallet.network,
          chain: null,
          fiat: offer.toAsset,
          price: offer.toAmount / Math.max(offer.fromAmount, 1),
          amount: offer.fromAmount,
          fiat_amount: offer.toAmount,
          buyer_bank_account_id: null,
          seller_bank_account_id: null,
          buyer_wallet_id: toWallet.id,
          expires_at: expiresAt,
          status: "created",
          payment_metadata: {
            kind: "crypto_swap",
            give_asset: offer.fromAsset,
            give_amount: offer.fromAmount,
            receive_asset: offer.toAsset,
            receive_amount: offer.toAmount,
            participant_from_wallet_id: fromWallet.id,
            participant_to_wallet_id: toWallet.id,
          },
        },
        token,
      );
      toast.success("교환 주문이 생성되었습니다. 거래방으로 이동합니다.");
      navigate({ to: "/app/order/$orderId/chat", params: { orderId: order.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "교환 주문 생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          to="/app/swap"
          className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold text-foreground">교환 주문 시작</div>
          <div className="text-[10px] font-semibold text-muted-foreground">
            온체인 락업 전 최종 확인
          </div>
        </div>
      </header>

      <div className="px-4 pt-4">
        <div className="rounded-3xl border border-border bg-card p-4 shadow-sm">
          <div className="text-[11px] font-bold text-muted-foreground">교환 조건</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-surface p-3">
              <div className="text-[10px] font-bold text-muted-foreground">내가 락업/보낼 코인</div>
              <div className="num-display text-[18px] font-extrabold text-foreground">
                {fmtNum(offer.fromAmount, 6)} {offer.fromAsset}
              </div>
            </div>
            <div className="rounded-2xl bg-primary-soft p-3 text-primary">
              <div className="text-[10px] font-bold">내가 받을 코인</div>
              <div className="num-display text-[18px] font-extrabold">
                {fmtNum(offer.toAmount, 6)} {offer.toAsset}
              </div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 rounded-xl bg-success-soft px-3 py-2 text-[11px] font-bold text-success">
            <ShieldCheck className="h-3.5 w-3.5" /> 주문 생성 후 거래방에서 양측 지갑과
            스마트컨트랙트 락업을 확인합니다.
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <Check ok={!offer.isMine} text="내 오퍼가 아닌 상대방 오퍼" />
          <Check ok={fromWallets.length > 0} text={`${offer.fromAsset} 보낼 지갑 등록`} />
          <Check ok={toWallets.length > 0} text={`${offer.toAsset} 받을 지갑 등록`} />
        </div>
      </div>

      <div className="h-24" />
      <div className="sticky bottom-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={start}
          disabled={!canStart || submitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground disabled:bg-surface-strong disabled:text-muted-foreground"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          교환 주문 시작
        </button>
      </div>
    </PhoneShell>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`rounded-2xl border p-3 text-[12px] font-bold ${ok ? "border-success bg-success-soft text-success" : "border-warning bg-warning-soft text-warning-foreground"}`}
    >
      {ok ? "✓" : "·"} {text}
    </div>
  );
}
