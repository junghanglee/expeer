import { useState } from "react";
import { ChevronDown, X, Search, Check, Coins, Banknote } from "lucide-react";
import {
  STABLE_ASSETS,
  VOLATILE_ASSETS,
  COIN_PRICE_USD,
  ASSET_META,
  FIAT_META,
  fmtNum,
  type CryptoAsset,
  type SwapPair,
  type FiatCode,
} from "@/data/format";

/* ============================================================
 * P2P 환전소용 페어 선택기 (바이낸스 P2P 스타일)
 * ============================================================ */

type Fiat = Extract<FiatCode, "KRW" | "USD">;
const FIATS = [FIAT_META.KRW, FIAT_META.USD] as const;

// 지원되는 페어 매핑
const SUPPORTED: Record<CryptoAsset, Fiat[]> = {
  USDT: ["KRW", "USD"],
  USDC: ["KRW"],
  DAI: [],
  BTC: [],
  ETH: [],
  SOL: [],
  BNB: [],
  MATIC: [],
  XRP: [],
};

function buildPair(asset: CryptoAsset, fiat: Fiat): SwapPair | null {
  const key = `${asset}/${fiat}` as SwapPair;
  if (key === "USDT/KRW" || key === "USDC/KRW" || key === "USDT/USD") return key;
  return null;
}

export function MarketPairPicker({
  pair,
  onChange,
}: {
  pair: SwapPair;
  onChange: (next: SwapPair) => void;
}) {
  const [openSide, setOpenSide] = useState<"asset" | "fiat" | null>(null);
  const [asset, fiat] = pair.split("/") as [CryptoAsset, Fiat];

  const selectAsset = (a: CryptoAsset) => {
    const allowed = SUPPORTED[a];
    if (!allowed.length) return;
    const nextFiat: Fiat = allowed.includes(fiat) ? fiat : allowed[0];
    const next = buildPair(a, nextFiat);
    if (next) onChange(next);
    setOpenSide(null);
  };

  const selectFiat = (f: Fiat) => {
    const next = buildPair(asset, f);
    if (next) onChange(next);
    setOpenSide(null);
  };

  const fiatMeta = FIAT_META[fiat];
  return (
    <>
      <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
        <button
          onClick={() => setOpenSide("asset")}
          className="card-lift flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <CoinBadge asset={asset} size="sm" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                코인
              </div>
              <div className="truncate text-[15px] font-extrabold text-foreground">{asset}</div>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <button
          onClick={() => setOpenSide("fiat")}
          className="card-lift flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-3 py-2.5 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xl leading-none">{fiatMeta.flag}</span>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                결제 통화
              </div>
              <div className="truncate text-[15px] font-extrabold text-foreground">
                {fiatMeta.symbol} {fiat}
              </div>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {openSide === "asset" && (
        <AssetSheet
          mode="market"
          selected={asset}
          onSelect={selectAsset}
          onClose={() => setOpenSide(null)}
        />
      )}
      {openSide === "fiat" && (
        <FiatSheet
          asset={asset}
          selected={fiat}
          onSelect={selectFiat}
          onClose={() => setOpenSide(null)}
        />
      )}
    </>
  );
}

/* ============================================================
 * P2P 코인 교환용 — "주는 코인 ↔ 받는 코인" 페어 선택
 * ============================================================ */
export function SwapPairPicker({
  from,
  to,
  onChange,
}: {
  from: CryptoAsset;
  to: CryptoAsset;
  onChange: (next: { from: CryptoAsset; to: CryptoAsset }) => void;
}) {
  const [openSide, setOpenSide] = useState<"from" | "to" | null>(null);

  const selectFrom = (a: CryptoAsset) => {
    onChange({ from: a, to: a === to ? from : to });
    setOpenSide(null);
  };
  const selectTo = (a: CryptoAsset) => {
    onChange({ from: a === from ? to : from, to: a });
    setOpenSide(null);
  };

  return (
    <>
      <div className="mx-4 mt-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <button
          onClick={() => setOpenSide("from")}
          className="card-lift flex items-center justify-between gap-1.5 rounded-2xl border border-border bg-card px-2.5 py-2.5 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <CoinBadge asset={from} size="sm" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                주는 코인
              </div>
              <div className="truncate text-[15px] font-extrabold text-foreground">{from}</div>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
        <button
          aria-label="swap-direction"
          onClick={() => onChange({ from: to, to: from })}
          className="flex items-center justify-center rounded-2xl bg-primary-soft px-3 text-primary"
        >
          ↔
        </button>
        <button
          onClick={() => setOpenSide("to")}
          className="card-lift flex items-center justify-between gap-1.5 rounded-2xl border border-border bg-card px-2.5 py-2.5 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <CoinBadge asset={to} size="sm" />
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                받는 코인
              </div>
              <div className="truncate text-[15px] font-extrabold text-foreground">{to}</div>
            </div>
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </div>

      {openSide === "from" && (
        <AssetSheet
          mode="swap"
          excluded={[to]}
          selected={from}
          onSelect={selectFrom}
          onClose={() => setOpenSide(null)}
        />
      )}
      {openSide === "to" && (
        <AssetSheet
          mode="swap"
          excluded={[from]}
          selected={to}
          onSelect={selectTo}
          onClose={() => setOpenSide(null)}
        />
      )}
    </>
  );
}

/* ============================================================
 * Asset 선택 시트 — 검색 + 카테고리(스테이블/일반) 그룹화
 * ============================================================ */
function AssetSheet({
  mode,
  selected,
  onSelect,
  onClose,
  excluded = [],
}: {
  mode: "market" | "swap";
  selected: CryptoAsset;
  onSelect: (a: CryptoAsset) => void;
  onClose: () => void;
  excluded?: CryptoAsset[];
}) {
  const [q, setQ] = useState("");
  const term = q.trim().toUpperCase();

  // market 모드는 KRW/USD 페어가 있는 자산만 노출
  const list = (arr: readonly CryptoAsset[]) =>
    arr.filter((a) => {
      if (excluded.includes(a)) return false;
      if (mode === "market" && SUPPORTED[a].length === 0) return false;
      return !term || a.includes(term);
    });

  const stables = list(STABLE_ASSETS);
  const volatiles = list(VOLATILE_ASSETS);

  return (
    <SheetShell title={mode === "market" ? "코인 선택" : "코인 선택"} onClose={onClose}>
      <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
        <Search className="h-4 w-4 text-muted-foreground" />
        <input
          autoFocus
          placeholder="검색 (예: USDT, BTC)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        {q && (
          <button onClick={() => setQ("")} aria-label="clear">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="mt-3 max-h-[60vh] overflow-y-auto">
        {stables.length > 0 && (
          <Group title="스테이블코인" icon={<Coins className="h-3 w-3" />}>
            {stables.map((a) => (
              <AssetRow
                key={a}
                asset={a}
                price={COIN_PRICE_USD[a]}
                disabled={mode === "market" && SUPPORTED[a].length === 0}
                active={a === selected}
                onClick={() => onSelect(a)}
              />
            ))}
          </Group>
        )}
        {mode === "swap" && volatiles.length > 0 && (
          <Group title="일반 코인" icon={<Banknote className="h-3 w-3" />}>
            {volatiles.map((a) => (
              <AssetRow
                key={a}
                asset={a}
                price={COIN_PRICE_USD[a]}
                active={a === selected}
                onClick={() => onSelect(a)}
              />
            ))}
          </Group>
        )}
        {stables.length + volatiles.length === 0 && (
          <div className="py-10 text-center text-[12px] text-muted-foreground">
            검색 결과가 없어요
          </div>
        )}
      </div>
    </SheetShell>
  );
}

function FiatSheet({
  asset,
  selected,
  onSelect,
  onClose,
}: {
  asset: CryptoAsset;
  selected: Fiat;
  onSelect: (f: Fiat) => void;
  onClose: () => void;
}) {
  return (
    <SheetShell title="결제 통화 선택" onClose={onClose}>
      <div className="mt-3 space-y-1.5">
        {FIATS.map((f) => {
          const code = f.code as Fiat;
          const supported = SUPPORTED[asset].includes(code);
          const active = code === selected;
          return (
            <button
              key={code}
              disabled={!supported}
              onClick={() => onSelect(code)}
              className={`flex w-full items-center justify-between rounded-xl border px-3 py-3 text-left transition-colors ${
                active
                  ? "border-primary bg-primary-soft"
                  : "border-border bg-card hover:border-primary/40"
              } ${!supported ? "opacity-40" : ""}`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-2xl leading-none">{f.flag}</span>
                <div>
                  <div className="text-[14px] font-extrabold text-foreground">
                    {f.symbol} {code}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{f.fullName}</div>
                </div>
              </div>
              {active ? (
                <Check className="h-4 w-4 text-primary" />
              ) : !supported ? (
                <span className="text-[10px] font-bold text-muted-foreground">{asset} 미지원</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </SheetShell>
  );
}

/* ============================================================
 * Shared sheet shell + small atoms
 * ============================================================ */
function SheetShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-[480px] rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between">
          <div className="text-[16px] font-extrabold text-foreground">{title}</div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Group({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1 flex items-center gap-1 px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {icon} {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function AssetRow({
  asset,
  price,
  active,
  disabled,
  onClick,
}: {
  asset: CryptoAsset;
  price: number;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
        active ? "border-primary bg-primary-soft" : "border-border bg-card hover:border-primary/40"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <CoinBadge asset={asset} size="md" />
        <div>
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-extrabold text-foreground">{asset}</span>
            <span className="text-[10px] text-muted-foreground">{ASSET_META[asset].fullName}</span>
          </div>
          <div className="num-display text-[10px] text-muted-foreground">${fmtNum(price)}</div>
        </div>
      </div>
      {active && <Check className="h-4 w-4 text-primary" />}
      {disabled && (
        <span className="text-[10px] font-bold text-muted-foreground">법정화폐 미지원</span>
      )}
    </button>
  );
}

/** 코인 컬러 배지 — 심볼/약어 표시 */
export function CoinBadge({
  asset,
  size = "md",
}: {
  asset: CryptoAsset;
  size?: "sm" | "md" | "lg";
}) {
  const meta = ASSET_META[asset];
  const sz =
    size === "sm"
      ? "h-7 w-7 text-[12px]"
      : size === "lg"
        ? "h-10 w-10 text-[16px]"
        : "h-8 w-8 text-[14px]";
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${meta.color} ${sz}`}
      aria-label={asset}
    >
      {meta.badge}
    </div>
  );
}
