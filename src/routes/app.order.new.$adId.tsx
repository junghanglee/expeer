import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Section } from "@/components/espeer/Section";
import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck, Loader2, ScanLine } from "lucide-react";
import { useOffer } from "@/hooks/useOffers";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useWallets } from "@/hooks/useWallets";
import { createOrder } from "@/hooks/useOrders";
import { useFeeSettings } from "@/hooks/useAppSettings";
import { networkToChain } from "@/lib/escrow";
import { toast } from "sonner";

export const Route = createFileRoute("/app/order/new/$adId")({
  head: () => ({ meta: [{ title: "주문 생성 — EXPEER" }] }),
  component: NewOrder,
});

function fmtNum(n: number, d = 4) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: d });
}

function NewOrder() {
  const { adId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { offer, loading } = useOffer(adId);
  const { accounts } = useBankAccounts();
  const { wallets } = useWallets();
  const { fees } = useFeeSettings();

  const isBuy = offer?.side === "sell"; // offer.side=sell → 사용자는 매수
  const matchingWallets = useMemo(
    () => wallets.filter((w) => w.asset === offer?.asset && w.network === offer?.network),
    [wallets, offer?.asset, offer?.network],
  );

  const [fiatStr, setFiatStr] = useState<string>("");
  const fiatNum = parseInt(fiatStr.replace(/\D/g, "") || "0", 10);
  const tokens = offer ? fiatNum / Number(offer.price) : 0;

  const [bankId, setBankId] = useState<string>("");
  const [walletId, setWalletId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <PhoneShell hideTab>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </PhoneShell>
    );
  }
  if (!offer) {
    return (
      <PhoneShell hideTab>
        <AppHeader title="오퍼 없음" />
        <div className="px-5 py-8 text-center text-muted-foreground">존재하지 않는 오퍼입니다.</div>
      </PhoneShell>
    );
  }

  // 코인 매수(=원화 송금자)는 환전 계좌인증 필수. 매도(코인 송금)는 면제.
  if (isBuy && profile && profile.kyc_status !== "approved") {
    return (
      <PhoneShell hideTab>
        <AppHeader title="환전 계좌인증 필요" subtitle="매수 주문 전 1회 인증" />
        <div className="px-5 pt-6">
          <div className="rounded-2xl border border-warning bg-warning-soft p-4">
            <div className="flex items-center gap-2">
              <ScanLine className="h-5 w-5 text-warning-foreground" />
              <span className="text-[14px] font-extrabold text-warning-foreground">
                코인 매수에는 환전 계좌인증이 필요합니다
              </span>
            </div>
            <p className="mt-2 text-[12px] text-warning-foreground/90">
              안전한 원화 송금을 위해 카메라로 신분증·셀카 1회 인증이 필요해요. 1분이면 끝납니다.
            </p>
          </div>
          <Link
            to="/onboarding/verify"
            className="mt-6 block rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground"
          >
            카메라로 1분 인증
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
  const amountValid = fiatNum >= minFiat && fiatNum <= maxFiat;
  const bankOk = !!bankId;
  const walletOk = isBuy ? !!walletId : true; // 매수자만 받을 지갑 필요 (이 데모)
  const canSubmit = amountValid && bankOk && walletOk && !!user;

  const onSubmit = async () => {
    if (!user || !offer) return;
    setSubmitting(true);
    try {
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
      const order = await createOrder({
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
        seller_bank_account_id: !isBuy ? bankId : null,
        buyer_wallet_id: isBuy ? walletId : null,
        expires_at: expiresAt,
        status: "created",
      });
      toast.success("주문이 생성되었습니다");
      navigate({ to: "/app/order/$orderId", params: { orderId: order.id } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "주문 생성 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader
        title={isBuy ? "코인 매수 주문" : "코인 매도 주문"}
        subtitle={`${offer.asset}/${offer.network}`}
      />

      <div className="px-5 pt-2">
        <div className="rounded-2xl bg-surface p-4">
          <div className="text-[11px] font-semibold text-muted-foreground">단가</div>
          <div className="num-display text-xl text-foreground">
            {Number(offer.price).toLocaleString("ko-KR")} {offer.fiat}
            <span className="ml-1 text-[12px] font-bold text-muted-foreground">
              / 1 {offer.asset}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            잔여: {fmtNum(Number(offer.available_amount))} {offer.asset}
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

      <Section title={isBuy ? "원화를 송금할 내 계좌" : "원화를 받을 내 계좌"}>
        {accounts.length === 0 ? (
          <Link
            to="/onboarding/bank"
            className="block rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-[13px] text-muted-foreground"
          >
            등록된 계좌가 없습니다. 먼저 계좌를 등록해주세요 →
          </Link>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setBankId(a.id)}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left ${
                  bankId === a.id ? "border-primary bg-primary-soft" : "border-border bg-card"
                }`}
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

      {isBuy && (
        <Section title={`${offer.asset} 받을 지갑 (${offer.network})`}>
          {matchingWallets.length === 0 ? (
            <Link
              to="/onboarding/wallet"
              className="block rounded-xl border border-dashed border-border bg-surface px-4 py-5 text-center text-[13px] text-muted-foreground"
            >
              해당 자산/네트워크 지갑이 없습니다. 등록 →
            </Link>
          ) : (
            <div className="space-y-2">
              {matchingWallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => setWalletId(w.id)}
                  className={`flex w-full flex-col rounded-xl border p-3 text-left ${
                    walletId === w.id ? "border-primary bg-primary-soft" : "border-border bg-card"
                  }`}
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

      <Section>
        <div className="rounded-2xl border border-warning bg-warning-soft p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            <div className="text-[12px] leading-relaxed text-warning-foreground">
              <b>제3자 송금은 자동 분쟁으로 처리됩니다.</b>
              <br />
              반드시 본인 명의 계좌에서 송금해 주세요. 결제 기한은 주문 생성 후 <b>15분</b>입니다.
            </div>
          </div>
        </div>
      </Section>

      <Section title="수수료 안내">
        <div className="rounded-2xl border border-border bg-card p-3 text-[12px]">
          <FeeRow
            label={`매수자 수수료 (${fees.buyer_pct}%)`}
            value={`${Math.round((fiatNum * fees.buyer_pct) / 100).toLocaleString("ko-KR")} ${offer.fiat}`}
            highlight={isBuy}
          />
          <FeeRow
            label={`매도자 수수료 (${fees.seller_pct}%)`}
            value={`${Math.round((fiatNum * fees.seller_pct) / 100).toLocaleString("ko-KR")} ${offer.fiat}`}
            highlight={!isBuy}
          />
          <div className="mt-2 border-t border-border pt-2 text-[10px] text-muted-foreground">
            거래 체결 시 위 수수료가 차감되어 정산됩니다. 수수료는 거래 시점 기준으로 고정됩니다.
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
            <Check ok={amountValid} text="거래 한도 내 금액" />
            <Check ok={bankOk} text="입출금 계좌 선택" />
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
              : "모든 항목을 완료하면 주문 생성 가능"}
        </button>
      </div>
    </PhoneShell>
  );
}

function Check({ ok, text }: { ok: boolean; text: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span
        className={`flex h-3.5 w-3.5 items-center justify-center rounded-full text-[9px] font-extrabold ${
          ok ? "bg-success text-success-foreground" : "bg-surface text-muted-foreground"
        }`}
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
