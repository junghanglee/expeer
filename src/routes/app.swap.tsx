import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { SwapPairPicker, CoinBadge } from "@/components/espeer/PairPicker";
import {
  ArrowLeft,
  ArrowRightLeft,
  BadgeCheck,
  Plus,
  Zap,
  Lock,
  Info,
  ShieldCheck,
  X,
  Sparkles,
  Coins,
} from "lucide-react";
import {
  COIN_PRICE_USD,
  STABLE_ASSETS,
  VOLATILE_ASSETS,
  MOCK_SAVED_ADDRESSES,
  fmtNum,
  type CryptoAsset,
  type CryptoSwapOffer,
} from "@/data/mock";
import { saveCryptoSwap, useCryptoSwaps } from "@/data/offerStore";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { NumberStepper } from "@/components/espeer/NumberStepper";
import { useLivePrices } from "@/hooks/useLivePrices";

// 실시간 시세를 우선 사용하고, 없으면 mock fallback
function useUsdPriceMap(assets: CryptoAsset[]): Record<CryptoAsset, number> {
  const { quotes } = useLivePrices(assets as string[]);
  const out = { ...COIN_PRICE_USD };
  for (const a of assets) {
    const p = quotes[a]?.priceUsd;
    if (p && p > 0) out[a] = p;
  }
  return out;
}

import {
  WalletAddressField,
  validateAddress,
  type SavedAddress,
} from "@/components/espeer/WalletAddressField";

export const Route = createFileRoute("/app/swap")({
  head: () => ({
    meta: [
      { title: "P2P 코인 교환 — EXPEER" },
      {
        name: "description",
        content:
          "스테이블코인과 일반 암호화폐를 시세 연동 비율로 P2P 교환. 비수탁 컨트랙트 락업 기반.",
      },
    ],
  }),
  component: SwapPage,
});

type Tab = "offers" | "myorders" | "done";

// 사용자 보유 코인 (mock) — 실제는 지갑 잔고에서 산출
const MY_HOLDINGS: { asset: CryptoAsset; balance: number }[] = [
  { asset: "USDT", balance: 1240.5 },
  { asset: "USDC", balance: 320 },
  { asset: "BTC", balance: 0.018 },
  { asset: "ETH", balance: 1.2 },
  { asset: "SOL", balance: 12 },
];

type HoldingFilter = "all" | CryptoAsset;

function SwapPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("offers");
  const [fromAsset, setFromAsset] = useState<CryptoAsset>("USDT");
  const [toAsset, setToAsset] = useState<CryptoAsset>("BTC");
  const [holdingFilter, setHoldingFilter] = useState<HoldingFilter>("all");
  const [showTicket, setShowTicket] = useState(false);

  // 전역 오퍼 스토어 — 사용자가 등록한 오퍼도 여기에 합쳐져서 모든 탭에 노출됨
  const allOffers = useCryptoSwaps();

  // 보유 코인 필터가 'all'이면 페어로 매칭, 아니면 "내가 가진 코인으로 받을 수 있는" 모든 오퍼 노출
  const offers = useMemo(() => {
    if (holdingFilter !== "all") {
      return allOffers.filter((o) => o.toAsset === holdingFilter);
    }
    return allOffers.filter(
      (o) =>
        (o.fromAsset === fromAsset && o.toAsset === toAsset) ||
        (o.fromAsset === toAsset && o.toAsset === fromAsset),
    );
  }, [fromAsset, toAsset, holdingFilter, allOffers]);

  const myOffers = useMemo(() => allOffers.filter((o) => o.isMine), [allOffers]);

  const doneList = useMemo(() => allOffers.filter((o) => o.status === "COMPLETED"), [allOffers]);

  return (
    <PhoneShell>
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-foreground">P2P 코인 교환</div>
            <div className="truncate text-[10px] font-semibold text-muted-foreground">
              코인 ↔ 코인 시세 연동
            </div>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-1 text-[10px] font-bold text-primary">
          <ArrowRightLeft className="h-3 w-3" /> P2P
        </span>
      </header>

      {/* 페어 선택 — 바이낸스 P2P 스타일: 주는 코인 ↔ 받는 코인 직접 선택 */}
      <SwapPairPicker
        from={fromAsset}
        to={toAsset}
        onChange={({ from, to }) => {
          setFromAsset(from);
          setToAsset(to);
        }}
      />

      {/* 시세 스트립 */}
      <PriceStrip />

      {/* 보유 코인 필터 — 내가 가진 코인으로 받을 수 있는 오퍼 빠르게 찾기 */}
      <div className="mt-3 px-4">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[11px] font-bold text-foreground">내 보유 코인으로 찾기</span>
          {holdingFilter !== "all" && (
            <button
              onClick={() => setHoldingFilter("all")}
              className="text-[10px] font-bold text-primary"
            >
              필터 해제
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setHoldingFilter("all")}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
              holdingFilter === "all"
                ? "bg-foreground text-background"
                : "border border-border bg-card text-muted-foreground"
            }`}
          >
            페어로 보기
          </button>
          {MY_HOLDINGS.map((h) => {
            const active = holdingFilter === h.asset;
            return (
              <button
                key={h.asset}
                onClick={() => setHoldingFilter(h.asset)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-foreground"
                }`}
              >
                <CoinBadge asset={h.asset} size="sm" />
                <span>{h.asset}</span>
                <span
                  className={`num-display text-[10px] ${active ? "opacity-90" : "text-muted-foreground"}`}
                >
                  {fmtNum(h.balance)}
                </span>
              </button>
            );
          })}
        </div>
        {holdingFilter !== "all" && (
          <div className="mt-1.5 rounded-lg bg-primary-soft px-2.5 py-1.5 text-[10px] font-semibold text-primary">
            {holdingFilter}을(를) 주고 다른 코인을 받을 수 있는 오퍼만 표시 중
          </div>
        )}
      </div>

      {/* 등록 버튼 */}
      <div className="mx-4 mt-2">
        <button
          onClick={() => setShowTicket(true)}
          className="card-lift flex w-full items-center justify-between gap-2 rounded-2xl bg-foreground px-4 py-3 text-background"
        >
          <div className="min-w-0 text-left">
            <div className="truncate text-[11px] font-semibold opacity-90">새 교환 오퍼 등록</div>
            <div className="truncate text-[14px] font-extrabold">내 코인 ↔ 다른 코인</div>
          </div>
          <Plus className="h-5 w-5 shrink-0" />
        </button>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex gap-1 px-4">
        <TabBtn active={tab === "offers"} onClick={() => setTab("offers")}>
          오퍼 <span className="ml-0.5 text-[11px] opacity-70">{offers.length}</span>
        </TabBtn>
        <TabBtn active={tab === "myorders"} onClick={() => setTab("myorders")}>
          내 오퍼 <span className="ml-0.5 text-[11px] opacity-70">{myOffers.length}</span>
        </TabBtn>
        <TabBtn active={tab === "done"} onClick={() => setTab("done")}>
          체결
        </TabBtn>
      </div>

      <div className="px-4 pt-3">
        {tab === "offers" &&
          (offers.length === 0 ? (
            <Empty msg="조건에 맞는 오퍼가 없어요" />
          ) : (
            <div className="space-y-2">
              {offers.map((o) => (
                <SwapOfferCard key={o.id} offer={o} mode="take" />
              ))}
            </div>
          ))}
        {tab === "myorders" &&
          (myOffers.length === 0 ? (
            <Empty msg="아직 등록한 오퍼가 없어요" />
          ) : (
            <div className="space-y-2">
              {myOffers.map((o) => (
                <SwapOfferCard key={o.id} offer={o} mode="mine" />
              ))}
            </div>
          ))}
        {tab === "done" &&
          (doneList.length === 0 ? (
            <Empty msg="체결된 교환이 없어요" />
          ) : (
            <div className="space-y-2">
              {doneList.map((o) => (
                <SwapOfferCard key={o.id} offer={o} mode="done" />
              ))}
            </div>
          ))}
      </div>

      <div className="h-6" />

      {showTicket && (
        <SwapTicketSheet
          initialFrom={fromAsset}
          initialTo={toAsset}
          onClose={() => setShowTicket(false)}
          onSubmit={async (o) => {
            if (!user) {
              toast.error("로그인 후 오퍼를 등록할 수 있어요");
              return;
            }
            try {
              await saveCryptoSwap(user.id, o);
              toast.success("교환 오퍼가 등록되었습니다");
              setShowTicket(false);
              setTab("myorders");
            } catch (e) {
              console.error("[swap.register]", e);
              toast.error(e instanceof Error ? e.message : "등록 실패");
            }
          }}
        />
      )}
    </PhoneShell>
  );
}

function PriceStrip() {
  const items: CryptoAsset[] = ["BTC", "ETH", "SOL", "BNB", "MATIC", "XRP"];
  const { quotes, prevQuotes } = useLivePrices(items as string[]);
  return (
    <div className="flex items-center gap-2 overflow-x-auto px-4 pt-3 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((c) => {
        const q = quotes[c];
        const p = q?.priceUsd ?? COIN_PRICE_USD[c];
        const prev = prevQuotes[c]?.priceUsd;
        const dir =
          prev && q ? (q.priceUsd > prev ? "up" : q.priceUsd < prev ? "down" : null) : null;
        const ch = q?.change24h ?? 0;
        return (
          <div
            key={c}
            className={`shrink-0 rounded-xl border bg-card px-2.5 py-1.5 transition-colors duration-500 ${
              dir === "up"
                ? "border-success/60 bg-success-soft/40"
                : dir === "down"
                  ? "border-destructive/60 bg-destructive-soft/40"
                  : "border-border"
            }`}
          >
            <div className="flex items-center justify-between gap-1.5">
              <div className="text-[10px] font-bold text-muted-foreground">{c}/USD</div>
              <div
                className={`text-[9px] font-bold ${ch >= 0 ? "text-success" : "text-destructive"}`}
              >
                {ch >= 0 ? "+" : ""}
                {ch.toFixed(2)}%
              </div>
            </div>
            <div className="num-display text-[12px] text-foreground">
              ${p < 10 ? p.toFixed(4) : fmtNum(p)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* FilterBtn 제거됨 — 페어 직접 선택으로 대체 */

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl py-2.5 text-[12px] font-bold transition-colors ${
        active ? "bg-foreground text-background" : "bg-surface text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card py-10 text-center text-[12px] text-muted-foreground">
      <Info className="mx-auto mb-2 h-4 w-4" />
      {msg}
    </div>
  );
}

/* ====== Offer Card ====== */
function SwapOfferCard({
  offer,
  mode,
}: {
  offer: CryptoSwapOffer;
  mode: "take" | "mine" | "done";
}) {
  const remain = Math.max(0, offer.fromAmount - offer.filledFromAmount);
  const rate = offer.toAmount / offer.fromAmount;
  const prices = useUsdPriceMap([offer.fromAsset, offer.toAsset]);
  const fairRate = prices[offer.fromAsset] / prices[offer.toAsset];
  const premium = ((rate - fairRate) / fairRate) * 100;
  const goodRate = premium >= -0.1; // 받는 쪽 입장에서 좋은가

  return (
    <div
      className={`card-lift rounded-2xl border bg-card p-3 ${
        mode === "mine" ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <AssetChip asset={offer.fromAsset} />
          <span className="text-[12px] font-extrabold text-foreground">{offer.fromAsset}</span>
          <ArrowRightLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <AssetChip asset={offer.toAsset} />
          <span className="text-[12px] font-extrabold text-foreground">{offer.toAsset}</span>
        </div>
        <span
          className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            goodRate ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
          }`}
        >
          {premium >= 0 ? "+" : ""}
          {premium.toFixed(2)}%
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-[12px]">
        <div>
          <div className="text-[10px] text-muted-foreground">제공</div>
          <div className="num-display text-[14px] text-foreground">
            {fmtNum(offer.fromAmount)} {offer.fromAsset}
          </div>
          <div className="text-[10px] text-muted-foreground">
            잔여 {fmtNum(remain)} {offer.fromAsset}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] text-muted-foreground">받기</div>
          <div className="num-display text-[14px] text-foreground">
            {fmtNum(offer.toAmount)} {offer.toAsset}
          </div>
          <div className="text-[10px] text-muted-foreground">
            1 {offer.fromAsset} = {fmtNum(rate, 6)} {offer.toAsset}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {offer.ownerIsMerchant && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
          <span className="font-semibold text-foreground/80">{offer.ownerName}</span>
          <span className="text-[10px]">Lv.{offer.ownerLevel}</span>
        </div>
        {mode === "mine" && (
          <span className="inline-flex items-center gap-0.5 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
            <Sparkles className="h-2.5 w-2.5" /> 내 오퍼
          </span>
        )}
      </div>

      {mode === "take" &&
        (offer.id.length > 20 ? (
          <Link
            to="/app/order/new/$adId"
            params={{ adId: offer.id }}
            className="mt-2.5 block w-full whitespace-nowrap rounded-xl bg-primary py-2 text-center text-[12px] font-extrabold text-primary-foreground transition-opacity hover:opacity-90"
          >
            이 비율로 교환
          </Link>
        ) : (
          <button
            disabled
            title="샘플 오퍼는 체결할 수 없습니다 — 직접 등록한 오퍼만 가능"
            className="mt-2.5 w-full whitespace-nowrap rounded-xl bg-surface py-2 text-[12px] font-bold text-muted-foreground"
          >
            샘플 오퍼 (체결 불가)
          </button>
        ))}
      {mode === "mine" && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button className="whitespace-nowrap rounded-xl bg-surface py-2 text-[11px] font-bold text-muted-foreground">
            비율 수정
          </button>
          <button className="whitespace-nowrap rounded-xl bg-destructive-soft py-2 text-[11px] font-bold text-destructive">
            오퍼 취소
          </button>
        </div>
      )}
    </div>
  );
}

function AssetChip({ asset }: { asset: CryptoAsset }) {
  return <CoinBadge asset={asset} size="sm" />;
}

/* ====== Ticket Sheet ====== */
function SwapTicketSheet({
  initialFrom,
  initialTo,
  onClose,
  onSubmit,
}: {
  initialFrom: CryptoAsset;
  initialTo: CryptoAsset;
  onClose: () => void;
  onSubmit: (o: CryptoSwapOffer) => void;
}) {
  const [from, setFrom] = useState<CryptoAsset>(initialFrom);
  const [to, setTo] = useState<CryptoAsset>(initialTo);
  const [fromAmount, setFromAmount] = useState<string>("");
  const [premium, setPremium] = useState<number>(0);

  // 양방향 지갑 주소
  const [savedAddrs, setSavedAddrs] = useState<SavedAddress[]>(
    MOCK_SAVED_ADDRESSES.map((s) => ({
      id: s.id,
      asset: s.asset as CryptoAsset,
      label: s.label,
      address: s.address,
    })),
  );
  const [fromAddr, setFromAddr] = useState<string>("");
  const [toAddr, setToAddr] = useState<string>("");

  const prices = useUsdPriceMap([from, to]);
  const fairRate = prices[from] / prices[to];
  const adjRate = fairRate * (1 + premium / 100);
  const numericFrom = Number(fromAmount) || 0;
  const toAmount = adjRate * numericFrom;

  // 지갑 주소는 선택 입력(매칭 시점에 컨트랙트가 사용). 등록 자체에는 필수가 아님.
  const fromAddrOk = !fromAddr || validateAddress(from, fromAddr).ok;
  const toAddrOk = !toAddr || validateAddress(to, toAddr).ok;
  const canSubmit = !!numericFrom && from !== to && fromAddrOk && toAddrOk;

  const submit = () => {
    if (from === to) {
      toast.error("받을 코인과 줄 코인이 같을 수 없어요");
      return;
    }
    if (!numericFrom || numericFrom <= 0) {
      toast.error("교환할 수량을 입력해 주세요");
      return;
    }
    if (fromAddr && !validateAddress(from, fromAddr).ok) {
      toast.error(`${from} 보낼 지갑 주소 형식이 올바르지 않아요`);
      return;
    }
    if (toAddr && !validateAddress(to, toAddr).ok) {
      toast.error(`${to} 받을 지갑 주소 형식이 올바르지 않아요`);
      return;
    }
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    onSubmit({
      id: `cx_my_${Date.now()}`,
      fromAsset: from,
      toAsset: to,
      fromAmount: numericFrom,
      toAmount,
      premiumPct: premium,
      ownerName: "김토스 (나)",
      ownerIsMerchant: false,
      ownerLevel: 3,
      status: "OPEN",
      createdAt: ts,
      filledFromAmount: 0,
      expectedFillSec: 120,
    });
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-[480px] max-h-[90vh] overflow-y-auto rounded-t-3xl bg-background p-5 pb-8 shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-extrabold text-foreground">새 교환 오퍼</div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* From */}
        <div className="mt-3 rounded-xl border border-border bg-card p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">내가 줄 코인</div>
          <div className="mt-1 flex items-center gap-2">
            <select
              value={from}
              onChange={(e) => setFrom(e.target.value as CryptoAsset)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] font-bold"
            >
              <optgroup label="스테이블">
                {STABLE_ASSETS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </optgroup>
              <optgroup label="일반 코인">
                {VOLATILE_ASSETS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </optgroup>
            </select>
            <input
              inputMode="decimal"
              placeholder="0"
              value={fromAmount}
              onChange={(e) => setFromAmount(e.target.value)}
              className="num-display flex-1 bg-transparent text-right text-[18px] text-foreground outline-none"
            />
          </div>
        </div>

        <div className="my-2 flex items-center justify-center">
          <button
            onClick={() => {
              const t = from;
              setFrom(to);
              setTo(t);
            }}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </button>
        </div>

        {/* To */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="text-[11px] font-semibold text-muted-foreground">내가 받을 코인</div>
          <div className="mt-1 flex items-center gap-2">
            <select
              value={to}
              onChange={(e) => setTo(e.target.value as CryptoAsset)}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] font-bold"
            >
              <optgroup label="스테이블">
                {STABLE_ASSETS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </optgroup>
              <optgroup label="일반 코인">
                {VOLATILE_ASSETS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </optgroup>
            </select>
            <span className="num-display flex-1 text-right text-[18px] text-foreground">
              {toAmount > 0 ? fmtNum(toAmount, 6) : "0"}
            </span>
          </div>
        </div>

        {/* 시세 + 프리미엄 */}
        <div className="mt-3 rounded-xl bg-surface p-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">시장 비율</span>
            <span className="num-display text-foreground">
              1 {from} = {fmtNum(fairRate, 6)} {to}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
            <span>
              프리미엄/할인 ({premium >= 0 ? "+" : ""}
              {premium.toFixed(1)}%)
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="프리미엄 1% 감소"
                onClick={() => setPremium((p) => Math.max(-3, Math.round((p - 1) * 10) / 10))}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-surface text-foreground hover:bg-primary hover:text-primary-foreground"
              >
                <span className="text-base font-bold">−</span>
              </button>
              <button
                type="button"
                aria-label="프리미엄 1% 증가"
                onClick={() => setPremium((p) => Math.min(3, Math.round((p + 1) * 10) / 10))}
                className="flex h-7 w-7 items-center justify-center rounded-md bg-surface text-foreground hover:bg-primary hover:text-primary-foreground"
              >
                <span className="text-base font-bold">+</span>
              </button>
            </div>
          </div>
          <input
            type="range"
            min={-3}
            max={3}
            step={0.1}
            value={premium}
            onChange={(e) => setPremium(Number(e.target.value))}
            className="mt-1 w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>-3% (빠름)</span>
            <span>0%</span>
            <span>+3% (느림)</span>
          </div>
          <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-primary">
            <Zap className="h-3 w-3" /> 적용 비율 1 {from} = {fmtNum(adjRate, 6)} {to}
          </div>
        </div>

        {/* 양방향 지갑 주소 — EXPEER는 지갑 미생성 */}
        <div className="mt-3 space-y-2">
          <WalletAddressField
            asset={from}
            value={fromAddr}
            onChange={setFromAddr}
            saved={savedAddrs}
            onSave={(e) => setSavedAddrs((p) => [e, ...p])}
            label={`${from} 보낼 본인 지갑 (선택 · 매칭 시 사용)`}
          />
          <WalletAddressField
            asset={to}
            value={toAddr}
            onChange={setToAddr}
            saved={savedAddrs}
            onSave={(e) => setSavedAddrs((p) => [e, ...p])}
            label={`${to} 받을 본인 지갑 (선택)`}
          />
        </div>

        {/* Zero-Custody */}
        <ul className="mt-3 space-y-1 text-[11px] text-foreground/70">
          <li className="flex gap-1.5">
            <ShieldCheck className="h-3 w-3 text-success" />
            컨트랙트가 양측 코인을 동시 락업
          </li>
          <li className="flex gap-1.5">
            <ShieldCheck className="h-3 w-3 text-success" />
            매칭 후 P2P 서명으로 동시 릴리즈
          </li>
          <li className="flex gap-1.5">
            <Lock className="h-3 w-3 text-primary" />
            EXPEER는 지갑·자산을 생성·보관하지 않음 (외부 지갑만 사용)
          </li>
        </ul>

        <button
          onClick={submit}
          className="mt-4 w-full rounded-2xl bg-primary py-3.5 text-[15px] font-extrabold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={!numericFrom || from === to}
        >
          <Coins className="mr-1 inline h-4 w-4" /> 교환 오퍼 등록
        </button>
        <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
          <Info className="h-3 w-3" /> 등록 즉시 '내 오퍼'에 표시되고 매칭을 기다립니다
        </div>
      </div>
    </div>
  );
}
