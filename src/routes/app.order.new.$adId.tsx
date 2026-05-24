import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Loader2, ScanLine, ShieldCheck } from "lucide-react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Section } from "@/components/espeer/Section";
import { useOffer } from "@/hooks/useOffers";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useWallets } from "@/hooks/useWallets";
import { createOrder } from "@/hooks/useOrders";
import { useSwapRequests } from "@/data/offerStore";
import { useFeeSettings } from "@/hooks/useAppSettings";
import { networkToChain } from "@/lib/escrow";
import { checkTradeApproval } from "@/utils/tradeApproval.functions";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/order/new/$adId")({
  validateSearch: z.object({
    amount: z
      .union([z.string(), z.number()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        if (typeof value === "number") return Number.isFinite(value) ? String(value) : undefined;
        let parsed = value;
        try {
          parsed = value.startsWith('"') ? JSON.parse(value) : value;
        } catch {
          return undefined;
        }
        const amount = Number(parsed);
        return Number.isFinite(amount) && amount > 0 ? String(amount) : undefined;
      }),
  }),
  head: () => ({ meta: [{ title: "주문 생성 — EXPEER" }] }),
  component: NewOrder,
});

function fmtNum(n: number, d = 4) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: d });
}

function NewOrder() {
  const { adId } = Route.useParams();
  const { amount: amountSearch } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { offer, loading } = useOffer(adId);
  const { accounts } = useBankAccounts();
  const { wallets } = useWallets();
  const { fees } = useFeeSettings();
  const ownOffers = useSwapRequests();
  const isDemoOffer = adId.startsWith("demo-");

  const isBuy = offer?.side === "sell";
  const matchingWallets = useMemo(
    () => wallets.filter((w) => w.asset === offer?.asset && w.network === offer?.network),
    [wallets, offer?.asset, offer?.network],
  );
  const defaultFiat = offer ? String(Number(offer.min_order)) : "";
  const amountFiat =
    offer && amountSearch ? Math.round(Number(amountSearch) * Number(offer.price)) : 0;
  const suggestedFiat = amountFiat > 0 ? String(amountFiat) : isDemoOffer ? defaultFiat : "";
  const [fiatStr, setFiatStr] = useState<string>(suggestedFiat);

  useEffect(() => {
    if (suggestedFiat && !fiatStr) setFiatStr(suggestedFiat);
  }, [suggestedFiat, fiatStr]);

  const fiatNum = parseInt(fiatStr.replace(/\D/g, "") || "0", 10);
  const tokens = offer ? fiatNum / Number(offer.price) : 0;
  const remainingToken = Number(offer?.available_amount ?? 0);
  const [bankId, setBankId] = useState<string>("");
  const [walletId, setWalletId] = useState<string>("");
  const [conflictChoice, setConflictChoice] = useState<"keep" | "pause" | "cancel" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const conflictingOwnOffers = useMemo(() => {
    if (!offer) return [];
    const pair = `${offer.asset}/${offer.fiat ?? "KRW"}`;
    return ownOffers.filter(
      (item) => item.isMine && item.status === "OPEN" && item.id !== offer.id && item.pair === pair,
    );
  }, [ownOffers, offer]);

  if (loading)
    return (
      <PhoneShell hideTab>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </PhoneShell>
    );
  if (!offer)
    return (
      <PhoneShell hideTab>
        <AppHeader title="오퍼 없음" />
        <div className="px-5 py-8 text-center text-muted-foreground">존재하지 않는 오퍼입니다.</div>
      </PhoneShell>
    );

  if (!isDemoOffer && isBuy && profile && profile.kyc_status !== "approved") {
    return (
      <PhoneShell hideTab>
        <AppHeader title="기본 인증 필요" subtitle="구매 주문 전 1분 인증" />
        <div className="px-5 pt-6">
          <div className="rounded-2xl border border-warning bg-warning-soft p-4">
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-warning-foreground" />
              <span className="text-[14px] font-extrabold text-warning-foreground">
                코인 구매에는 기본 인증이 필요합니다.
              </span>
            </div>
            <p className="mt-2 text-[12px] text-warning-foreground/90">
              안전한 원화 송금을 위해 휴대폰 기반 1분 인증을 먼저 완료해 주세요.
            </p>
          </div>
          <Link
            to="/onboarding/verify"
            className="mt-6 block rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground"
          >
            1분 인증하기
          </Link>
          <button
            onClick={() => navigate({ to: "/app/market" })}
            className="mt-2 block w-full rounded-xl bg-surface py-3 text-[13px] font-bold text-foreground"
          >
            나중에 하기
          </button>
        </div>
      </PhoneShell>
    );
  }

  const minFiat = Number(offer.min_order);
  const maxFiat = Math.min(
    Number(offer.max_order),
    Number(offer.available_amount) * Number(offer.price),
  );
  const amountValid = fiatNum >= minFiat && fiatNum <= maxFiat && tokens <= remainingToken;
  const bankOk = isDemoOffer || !!bankId;
  const walletOk = isDemoOffer || (isBuy ? !!walletId : true);
  const conflictResolved = conflictingOwnOffers.length === 0 || !!conflictChoice;
  const canSubmit =
    amountValid &&
    bankOk &&
    walletOk &&
    conflictResolved &&
    (isDemoOffer || (!!user && !!profile?.phone));

  const onSubmit = async () => {
    if (!offer) return;
    if (isDemoOffer) {
      const order = await createOrder({
        ad_id: offer.id,
        buyer_id: isBuy ? "demo-current-user" : offer.user_id,
        seller_id: isBuy ? offer.user_id : "demo-current-user",
        asset: offer.asset,
        network: offer.network,
        chain: networkToChain(offer.network) ?? "base-sepolia",
        fiat: offer.fiat ?? "KRW",
        price: offer.price,
        amount: tokens || 1,
        fiat_amount: fiatNum || Number(offer.min_order),
        buyer_bank_account_id: isBuy ? "demo-buyer-bank" : null,
        seller_bank_account_id: isBuy ? "demo-seller-bank" : "demo-seller-bank",
        buyer_wallet_id: isBuy ? "demo-buyer-wallet" : null,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        status: "created",
      });
      toast.success("테스트 주문이 생성되었습니다.");
      navigate({ to: "/app/order/$orderId", params: { orderId: order.id } });
      return;
    }
    if (!user || !offer) return;
    setSubmitting(true);
    try {
      if (conflictingOwnOffers.length > 0 && !conflictChoice)
        throw new Error("진행 중인 내 오퍼 처리 방식을 선택해 주세요.");
      if (conflictChoice === "pause" || conflictChoice === "cancel") {
        const nextStatus = conflictChoice === "pause" ? "paused" : "cancelled";
        const conflictIds = conflictingOwnOffers.map((item) => item.id);
        const { error: conflictError } = await supabase
          .from("ads")
          .update({ status: nextStatus })
          .in("id", conflictIds)
          .eq("user_id", user.id);
        if (conflictError) throw conflictError;
      }
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const approval = await checkTradeApproval({
        data: { counterpartyId: offer.user_id },
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!approval.ok) throw new Error(approval.message);
      if (tokens > remainingToken)
        throw new Error(
          "오퍼의 남은 수량을 초과했습니다. 금액을 줄이거나 다른 오퍼를 선택해 주세요.",
        );

      const sellerBankId = isBuy ? await findPrimaryBankAccountId(offer.user_id) : null;
      const order = await createOrder(
        {
          ad_id: offer.id,
          buyer_id: isBuy ? user.id : offer.user_id,
          seller_id: isBuy ? offer.user_id : user.id,
          asset: offer.asset,
          network: offer.network,
          chain: networkToChain(offer.network) ?? "base-sepolia",
          fiat: offer.fiat ?? "KRW",
          price: offer.price,
          amount: tokens,
          fiat_amount: fiatNum,
          buyer_bank_account_id: isBuy ? bankId : null,
          seller_bank_account_id: isBuy ? sellerBankId : bankId,
          buyer_wallet_id: isBuy ? walletId : null,
          expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
          status: "created",
        },
        token,
      );
      toast.success("주문이 생성되었습니다. 거래방으로 이동합니다.");
      navigate({ to: "/app/order/$orderId/chat", params: { orderId: order.id } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "주문 생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader
        title={isBuy ? "코인 구매 주문" : "코인 판매 주문"}
        subtitle={`${offer.asset}/${offer.network}`}
      />
      <div className="px-5 pt-2">
        {isDemoOffer && (
          <div className="mb-3 rounded-2xl border border-success bg-success-soft p-3 text-[12px] font-semibold leading-relaxed text-success">
            테스트 오퍼입니다. 계좌/지갑 등록 없이 금액만 입력해 주문 생성 → 주문 상세 → 채팅방
            → 증빙 흐름을 확인할 수 있습니다.
          </div>
        )}
        <div className="rounded-2xl border border-primary bg-primary-soft p-3">
          <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" /> 부분 거래 가능 오퍼
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-primary/90">
            이 오퍼의 남은 수량 안에서 주문을 만들 수 있습니다. 주문 생성 후 거래방에서 입금/락업
            확인을 진행합니다.
          </p>
        </div>
        <div className="mt-3 rounded-2xl bg-surface p-4">
          <div className="text-[11px] font-semibold text-muted-foreground">가격</div>
          <div className="num-display text-xl text-foreground">
            {Number(offer.price).toLocaleString("ko-KR")} {offer.fiat}
            <span className="ml-1 text-[12px] font-bold text-muted-foreground">
              / 1 {offer.asset}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            남은 수량: {fmtNum(Number(offer.available_amount))} {offer.asset}
          </div>
        </div>
        <div className="mt-4">
          <div className="text-[11px] font-semibold text-muted-foreground">
            {isBuy ? "보낼 금액" : "받을 금액"} ({offer.fiat})
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <input
              inputMode="numeric"
              value={fiatNum ? fiatNum.toLocaleString("ko-KR") : ""}
              onChange={(e) => setFiatStr(e.target.value.replace(/\D/g, ""))}
              placeholder="0"
              className="num-display w-full bg-transparent text-[34px] font-extrabold text-foreground focus:outline-none"
            />
            <span className="text-[16px] font-bold text-muted-foreground">{offer.fiat}</span>
          </div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            {isBuy ? "받을 코인" : "보낼 코인"}:{" "}
            <b className="text-foreground">
              {fmtNum(tokens, 4)} {offer.asset}
            </b>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            한도 {minFiat.toLocaleString("ko-KR")} ~ {maxFiat.toLocaleString("ko-KR")} {offer.fiat}
          </div>
        </div>
      </div>

      {!isDemoOffer && (
        <Section title={isBuy ? "원화를 송금할 내 계좌" : "원화를 받을 내 계좌"}>
          {accounts.length === 0 ? (
            <Link
              to="/onboarding/bank"
              className="block rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-[13px] text-muted-foreground"
            >
              등록된 계좌가 없습니다. 먼저 계좌를 등록해 주세요.
            </Link>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setBankId(a.id)}
                  className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${bankId === a.id ? "border-primary bg-primary-soft" : "border-border bg-card"}`}
                >
                  <div>
                    <div className="text-[13px] font-bold text-foreground">{a.bank_name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {a.account_number} · {a.account_holder}
                    </div>
                  </div>
                  {a.is_primary && (
                    <span className="rounded-full bg-surface-strong px-2 py-0.5 text-[10px] font-bold">
                      기본
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {!isDemoOffer && isBuy && (
        <Section title={`${offer.asset} 받을 지갑 (${offer.network})`}>
          {matchingWallets.length === 0 ? (
            <Link
              to="/onboarding/wallet"
              className="block rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-[13px] text-muted-foreground"
            >
              이 자산/네트워크 지갑이 없습니다. 먼저 지갑을 등록해 주세요.
            </Link>
          ) : (
            <div className="space-y-2">
              {matchingWallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWalletId(w.id)}
                  className={`flex w-full flex-col rounded-xl border p-3 text-left ${walletId === w.id ? "border-primary bg-primary-soft" : "border-border bg-card"}`}
                >
                  <div className="text-[12px] font-bold text-foreground">
                    {w.label || `${w.asset} 지갑`}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground">
                    {w.address.slice(0, 12)}…{w.address.slice(-8)}
                  </div>
                </button>
              ))}
            </div>
          )}
        </Section>
      )}

      {conflictingOwnOffers.length > 0 && (
        <Section title="내 기존 오퍼 처리">
          <div className="rounded-2xl border border-warning bg-warning-soft p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
              <div>
                <div className="text-[12px] font-extrabold text-warning-foreground">
                  같은 방향의 내 오퍼 {conflictingOwnOffers.length}건이 있습니다
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-warning-foreground/90">
                  다른 오퍼에 직접 참여하기 전에 기존 오퍼를 유지할지, 일시중지/취소할지 선택해
                  주세요.
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {(
                [
                  ["keep", "유지"],
                  ["pause", "일시중지"],
                  ["cancel", "취소"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  onClick={() => setConflictChoice(value)}
                  className={`rounded-xl py-2 text-[11px] font-extrabold ${conflictChoice === value ? "bg-foreground text-background" : "bg-background text-muted-foreground"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>
      )}

      <Section>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[12px] font-extrabold text-foreground">거래 안전 확인</span>
          </div>
          <ul className="mt-2 space-y-1 text-[11px]">
            <Check ok={isDemoOffer || !!profile?.phone} text="휴대폰 번호 등록" />
            <Check ok={isDemoOffer || profile?.kyc_status === "approved"} text="기본 인증 완료" />
            <Check ok text="상대방 블랙리스트 자동 확인" />
          </ul>
          <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
            주문 생성 직전에 상대방 상태를 다시 확인합니다.
          </p>
        </div>
      </Section>

      <Section>
        <div className="rounded-2xl border border-warning bg-warning-soft p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            <div className="text-[12px] leading-relaxed text-warning-foreground">
              <b>거래방 밖 송금은 분쟁으로 처리될 수 있습니다.</b>
              <br />
              주문 금액과 입금자명을 맞추고, 결제 기한은 주문 생성 후 <b>15분</b>입니다.
            </div>
          </div>
        </div>
      </Section>

      <Section title="수수료 안내">
        <div className="rounded-2xl border border-border bg-card p-3 text-[12px]">
          <FeeRow
            label={`참여자 수수료 (${fees.buyer_pct}%)`}
            value={`${fmtNum((tokens * fees.buyer_pct) / 100, 6)} ${offer.asset}`}
            highlight={isBuy}
          />
          <FeeRow
            label={`오퍼 등록자 수수료 (${fees.seller_pct}%)`}
            value={`${fmtNum((tokens * fees.seller_pct) / 100, 6)} ${offer.asset}`}
            highlight={!isBuy}
          />
          <div className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
            수수료는 거래 코인 기준으로 계산됩니다. 플랫폼은 현금과 코인을 보관하지 않습니다.
          </div>
        </div>
      </Section>

      <Section>
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="text-[12px] font-extrabold text-foreground">체크리스트</span>
          </div>
          <ul className="mt-2 space-y-1 text-[11px]">
            <Check ok={amountValid} text="거래 한도와 남은 수량 안의 금액" />
            <Check ok={isDemoOffer || !!profile?.phone} text="휴대폰 번호 등록" />
            <Check ok={bankOk} text="계좌 선택" />
            {isBuy && <Check ok={walletOk} text="받을 지갑 선택" />}
          </ul>
        </div>
      </Section>

      <div className="h-24" />
      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          disabled={!canSubmit || submitting}
          onClick={onSubmit}
          className="block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground disabled:bg-surface-strong disabled:text-muted-foreground"
        >
          {submitting
            ? "생성 중…"
            : canSubmit
              ? "주문 생성"
              : "필수 항목을 완료하면 주문 생성 가능"}
        </button>
      </div>
    </PhoneShell>
  );
}

async function findPrimaryBankAccountId(userId: string) {
  const { data, error } = await supabase.rpc("get_primary_bank_account_id", { _user_id: userId });
  if (error) throw error;
  return data ?? null;
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-extrabold ${ok ? "bg-success text-success-foreground" : "bg-surface text-muted-foreground"}`}
      >
        {ok ? "✓" : "·"}
      </span>
      <span className={ok ? "text-foreground" : "text-muted-foreground"}>{text}</span>
    </li>
  );
}

function FeeRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1 ${highlight ? "font-bold text-foreground" : "text-muted-foreground"}`}
    >
      <span>
        {label}
        {highlight && (
          <span className="ml-1 rounded bg-primary-soft px-1 text-[10px] text-primary">
            내 부담
          </span>
        )}
      </span>
      <span className="num-display">{value}</span>
    </div>
  );
}
