import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { ArrowLeft, ArrowLeftRight, Loader2, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/lib/auth";
import { useWallets } from "@/hooks/useWallets";
import { saveCryptoSwap } from "@/data/offerStore";
import { ASSET_META, COIN_PRICE_USD, type CryptoAsset, type CryptoSwapOffer } from "@/data/format";
import { useLivePrices } from "@/hooks/useLivePrices";
import { toast } from "sonner";

const searchSchema = z.object({
  give: z.string().optional(),
  receive: z.string().optional(),
  amount: z.string().optional(),
});

export const Route = createFileRoute("/app/swap/new")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "교환 오퍼 등록 — EXPEER" }] }),
  component: NewSwapOffer,
});

const CRYPTO_ASSETS: CryptoAsset[] = [
  "USDT",
  "USDC",
  "DAI",
  "BTC",
  "ETH",
  "SOL",
  "BNB",
  "XRP",
  "MATIC",
];

type PickerTarget = "from" | "to";

function isCryptoAsset(value?: string): value is CryptoAsset {
  return !!value && CRYPTO_ASSETS.includes(value as CryptoAsset);
}

function useUsdPriceMap() {
  const { quotes } = useLivePrices(CRYPTO_ASSETS as string[]);
  return CRYPTO_ASSETS.reduce(
    (map, asset) => {
      map[asset] = quotes[asset]?.priceUsd || COIN_PRICE_USD[asset] || 0;
      return map;
    },
    {} as Record<CryptoAsset, number>,
  );
}

function fairReceiveAmount(
  from: CryptoAsset,
  to: CryptoAsset,
  amount: number,
  prices: Record<CryptoAsset, number>,
) {
  return prices[from] && prices[to] ? (amount * prices[from]) / prices[to] : 0;
}

function sanitizeAmount(value: string) {
  return value.replace(/[^\d.]/g, "");
}

function NewSwapOffer() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { wallets } = useWallets();
  const prices = useUsdPriceMap();

  const initialFrom = isCryptoAsset(search.give) ? search.give : "USDT";
  const initialTo =
    isCryptoAsset(search.receive) && search.receive !== initialFrom ? search.receive : "BTC";
  const initialAmount = search.amount ?? "100";

  const [fromAsset, setFromAsset] = useState<CryptoAsset>(initialFrom);
  const [toAsset, setToAsset] = useState<CryptoAsset>(initialTo);
  const [fromAmount, setFromAmount] = useState(initialAmount);
  const [toAmount, setToAmount] = useState(() =>
    String(
      Number(fairReceiveAmount(initialFrom, initialTo, Number(initialAmount), prices).toFixed(6)) ||
        "",
    ),
  );
  const [minAmount, setMinAmount] = useState("10");
  const [maxAmount, setMaxAmount] = useState(initialAmount);
  const [pickerOpen, setPickerOpen] = useState<PickerTarget | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const matchingWallets = useMemo(
    () => wallets.filter((wallet) => wallet.asset === fromAsset),
    [wallets, fromAsset],
  );
  const expectedTo = fairReceiveAmount(fromAsset, toAsset, Number(fromAmount) || 0, prices);
  const premiumPct = expectedTo > 0 ? ((Number(toAmount) - expectedTo) / expectedTo) * 100 : 0;
  const valid =
    !!user &&
    matchingWallets.length > 0 &&
    fromAsset !== toAsset &&
    [fromAmount, toAmount, minAmount, maxAmount].every((v) => Number(v) > 0) &&
    Number(maxAmount) >= Number(minAmount) &&
    Number(maxAmount) <= Number(fromAmount);

  const chooseAsset = (target: PickerTarget, asset: CryptoAsset) => {
    if (target === "from") {
      setFromAsset(asset);
      if (asset === toAsset) setToAsset(CRYPTO_ASSETS.find((item) => item !== asset) ?? "BTC");
    } else {
      setToAsset(asset);
      if (asset === fromAsset) setFromAsset(CRYPTO_ASSETS.find((item) => item !== asset) ?? "USDT");
    }
    setPickerOpen(null);
    setPickerQuery("");
  };

  const switchAssets = () => {
    setFromAsset(toAsset);
    setToAsset(fromAsset);
    setPickerOpen(null);
    setPickerQuery("");
  };

  const setSendAmount = (value: string) => {
    const clean = sanitizeAmount(value);
    setFromAmount(clean);
    setMaxAmount(clean);
    setToAmount(
      clean
        ? String(Number(fairReceiveAmount(fromAsset, toAsset, Number(clean), prices).toFixed(6)))
        : "",
    );
  };

  const pickerOptions = (
    pickerOpen
      ? CRYPTO_ASSETS.filter((asset) => asset !== (pickerOpen === "from" ? toAsset : fromAsset))
      : []
  ).filter((asset) => {
    const q = pickerQuery.trim().toLowerCase();
    return (
      !q || asset.toLowerCase().includes(q) || ASSET_META[asset].fullName.toLowerCase().includes(q)
    );
  });

  const submit = async () => {
    if (!valid || !user) {
      toast.error("입력값과 보낼 지갑을 확인해 주세요");
      return;
    }
    setSubmitting(true);
    try {
      const offer: CryptoSwapOffer = {
        id: crypto.randomUUID(),
        fromAsset,
        toAsset,
        fromAmount: Number(fromAmount),
        toAmount: Number(toAmount),
        premiumPct,
        ownerName: "나",
        ownerIsMerchant: false,
        ownerLevel: 3,
        status: "OPEN",
        createdAt: new Date().toISOString(),
        expectedFillSec: 120,
        filledFromAmount: 0,
        minFromAmount: Number(minAmount),
        maxFromAmount: Number(maxAmount),
        activeOrderCount: 0,
        paymentWindowMin: 15,
        isMine: true,
      };
      await saveCryptoSwap(user.id, offer);
      toast.success("교환 오퍼가 등록되었습니다.");
      navigate({ to: "/app/swap" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "등록 실패");
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
          <div className="text-[15px] font-extrabold text-foreground">교환 오퍼 등록</div>
          <div className="text-[10px] font-semibold text-muted-foreground">
            코인 간 P2P 교환 조건
          </div>
        </div>
      </header>

      <div className="mx-4 mt-3 rounded-xl border border-primary-soft bg-primary-soft/60 p-2.5 text-[11px] leading-relaxed text-primary">
        <b>코인 간 교환 전용입니다.</b> KRW 거래는 P2P환전을 이용해 주세요.
      </div>

      <section className="px-4 pt-3">
        <div className="space-y-2 rounded-2xl border border-border bg-card p-2.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <CoinButton
              label="내가 줄 것"
              value={fromAsset}
              active={pickerOpen === "from"}
              onClick={() => setPickerOpen(pickerOpen === "from" ? null : "from")}
            />
            <button
              onClick={switchAssets}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background"
              aria-label="주는 것과 받을 것 바꾸기"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
            <CoinButton
              label="내가 받을 것"
              value={toAsset}
              active={pickerOpen === "to"}
              onClick={() => setPickerOpen(pickerOpen === "to" ? null : "to")}
            />
          </div>
          {pickerOpen && (
            <CoinPicker
              options={pickerOptions}
              query={pickerQuery}
              onQuery={setPickerQuery}
              onPick={(asset) => chooseAsset(pickerOpen, asset)}
            />
          )}
        </div>
      </section>

      <section className="space-y-2 px-4 pt-3">
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <AmountInput
            label={`보낼 수량 (${fromAsset})`}
            value={fromAmount}
            onChange={setSendAmount}
          />
          <InfoBox label="예상 수령" value={Number(expectedTo.toFixed(6)).toString()} />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <AmountInput
            label={`받을 수량 (${toAsset})`}
            value={toAmount}
            onChange={(v) => setToAmount(sanitizeAmount(v))}
          />
          <button
            onClick={() => setToAmount(String(Number(expectedTo.toFixed(6))))}
            className="h-[52px] min-w-[108px] rounded-xl bg-foreground px-3 text-[11px] font-extrabold text-background"
          >
            공정가 적용
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <AmountInput
            label="최소 주문 수량"
            value={minAmount}
            onChange={(v) => setMinAmount(sanitizeAmount(v))}
          />
          <AmountInput
            label="최대 주문 수량"
            value={maxAmount}
            onChange={(v) => setMaxAmount(sanitizeAmount(v))}
          />
        </div>
        <div
          className={`text-[11px] font-bold ${premiumPct >= 0 ? "text-success" : "text-destructive"}`}
        >
          시세 대비 {premiumPct >= 0 ? "+" : ""}
          {premiumPct.toFixed(2)}%
        </div>
      </section>

      <section className="px-4 pt-3">
        <div
          className={`rounded-xl border p-2.5 ${matchingWallets.length ? "border-success bg-success-soft" : "border-warning bg-warning-soft"}`}
        >
          <div className="flex items-center gap-1.5 text-[12px] font-extrabold">
            <ShieldCheck className="h-3.5 w-3.5" /> 지갑 확인
          </div>
          <p className="mt-1 text-[11px] leading-relaxed">
            {matchingWallets.length
              ? `${fromAsset} 지갑 ${matchingWallets.length}개 확인됨`
              : `${fromAsset} 보낼 지갑을 먼저 등록해 주세요.`}
          </p>
        </div>
      </section>

      <div className="h-24" />
      <div className="sticky bottom-0 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          disabled={!valid || submitting}
          onClick={submit}
          className="w-full rounded-xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground disabled:bg-surface-strong disabled:text-muted-foreground"
        >
          {submitting ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : valid ? (
            "교환 오퍼 등록"
          ) : (
            "입력값을 확인해 주세요"
          )}
        </button>
      </div>
    </PhoneShell>
  );
}

function CoinButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: CryptoAsset;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-11 rounded-xl px-3 text-left ${active ? "bg-primary text-primary-foreground" : "bg-foreground text-background"}`}
    >
      <div className="text-[10px] font-bold opacity-70">{label}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span className="rounded-full bg-background/15 px-1.5 text-[9px]">
          {ASSET_META[value].badge}
        </span>
        <span className="text-[13px] font-extrabold">{value}</span>
      </div>
    </button>
  );
}

function CoinPicker({
  options,
  query,
  onQuery,
  onPick,
}: {
  options: CryptoAsset[];
  query: string;
  onQuery: (value: string) => void;
  onPick: (asset: CryptoAsset) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-2 shadow-sm">
      <input
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="코인명 검색"
        className="mb-2 h-9 w-full rounded-xl bg-surface px-3 text-[12px] font-bold outline-none"
      />
      <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
        {options.map((asset) => (
          <button
            key={asset}
            onClick={() => onPick(asset)}
            className="flex h-11 w-full items-center justify-between rounded-xl bg-card px-3 text-left"
          >
            <span className="font-extrabold">{asset}</span>
            <span className="text-[10px] font-bold text-muted-foreground">
              {ASSET_META[asset].fullName}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function AmountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="num-display h-7 w-full bg-transparent text-[16px] font-extrabold outline-none"
      />
    </label>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[108px] rounded-xl bg-surface px-3 py-2 text-right">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <div className="num-display h-7 text-[13px] font-extrabold text-foreground">{value}</div>
    </div>
  );
}
