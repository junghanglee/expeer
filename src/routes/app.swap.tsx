import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { ArrowLeftRight, ArrowLeft, BadgeCheck, Plus, ShieldCheck, Sparkles } from "lucide-react";
import {
  ASSET_META,
  COIN_PRICE_USD,
  fmtNum,
  type CryptoAsset,
  type CryptoSwapOffer,
} from "@/data/format";
import { useCryptoSwaps } from "@/data/offerStore";
import { useLivePrices } from "@/hooks/useLivePrices";

export const Route = createFileRoute("/app/swap")({
  head: () => ({
    meta: [
      { title: "교환 — EXPEER" },
      { name: "description", content: "코인 간 P2P 교환 오퍼를 찾고 직접 조건을 등록합니다." },
    ],
  }),
  component: SwapPage,
});

type Tab = "offers" | "my" | "done";
type SwapSortKey = "best" | "amount" | "newest";

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
const SORT_OPTIONS: { key: SwapSortKey; label: string }[] = [
  { key: "best", label: "유리한 조건순" },
  { key: "amount", label: "수량 많은순" },
  { key: "newest", label: "최신순" },
];

function useUsdPriceMap(assets: CryptoAsset[]) {
  const { quotes } = useLivePrices(assets as string[]);
  const out = { ...COIN_PRICE_USD } as Record<CryptoAsset, number>;
  for (const asset of assets) {
    const p = quotes[asset]?.priceUsd;
    if (p && p > 0) out[asset] = p;
  }
  return out;
}

function expectedToAmount(
  from: CryptoAsset,
  to: CryptoAsset,
  amount: number,
  prices: Record<CryptoAsset, number>,
) {
  const fromUsd = prices[from] || 0;
  const toUsd = prices[to] || 0;
  return fromUsd > 0 && toUsd > 0 ? (amount * fromUsd) / toUsd : 0;
}

function offerAdvantagePct(
  offer: CryptoSwapOffer,
  give: CryptoAsset,
  receive: CryptoAsset,
  prices: Record<CryptoAsset, number>,
) {
  const sameDirection = offer.fromAsset === give && offer.toAsset === receive;
  const giveAmount = sameDirection ? offer.fromAmount : offer.toAmount;
  const receiveAmount = sameDirection ? offer.toAmount : offer.fromAmount;
  const fairReceive = expectedToAmount(give, receive, giveAmount, prices);
  return fairReceive > 0 ? ((receiveAmount - fairReceive) / fairReceive) * 100 : 0;
}

function SwapPage() {
  const [giveAsset, setGiveAsset] = useState<CryptoAsset>("USDT");
  const [receiveAsset, setReceiveAsset] = useState<CryptoAsset>("BTC");
  const [giveAmount, setGiveAmount] = useState("");
  const [sort, setSort] = useState<SwapSortKey>("best");
  const [tab, setTab] = useState<Tab>("offers");
  const [pickerOpen, setPickerOpen] = useState<"give" | "receive" | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const allOffers = useCryptoSwaps();
  const prices = useUsdPriceMap(CRYPTO_ASSETS);
  const numericGiveAmount = Number(giveAmount.replace(/[^0-9.]/g, "")) || 0;
  const fairReceive = expectedToAmount(giveAsset, receiveAsset, numericGiveAmount, prices);

  const visibleOffers = useMemo(() => {
    const list = allOffers.filter((offer) => {
      if (offer.status !== "OPEN") return false;
      const direct = offer.fromAsset === giveAsset && offer.toAsset === receiveAsset;
      const reverse = offer.fromAsset === receiveAsset && offer.toAsset === giveAsset;
      if (!direct && !reverse) return false;
      if (!numericGiveAmount) return true;
      const remainGive = direct
        ? Math.max(0, offer.fromAmount - offer.filledFromAmount)
        : Math.max(
            0,
            offer.toAmount -
              (offer.filledFromAmount * offer.toAmount) / Math.max(offer.fromAmount, 1),
          );
      const min = direct ? (offer.minFromAmount ?? 0) : 0;
      const max = direct
        ? Math.min(offer.maxFromAmount ?? offer.fromAmount, remainGive)
        : remainGive;
      return numericGiveAmount >= min && numericGiveAmount <= max;
    });
    const sorted = [...list];
    if (sort === "amount") {
      sorted.sort(
        (a, b) =>
          Math.max(0, b.fromAmount - b.filledFromAmount) -
          Math.max(0, a.fromAmount - a.filledFromAmount),
      );
    } else if (sort === "newest") {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else {
      sorted.sort(
        (a, b) =>
          offerAdvantagePct(b, giveAsset, receiveAsset, prices) -
          offerAdvantagePct(a, giveAsset, receiveAsset, prices),
      );
    }
    return sorted;
  }, [allOffers, giveAsset, receiveAsset, numericGiveAmount, prices, sort]);

  const myOffers = useMemo(() => allOffers.filter((offer) => offer.isMine), [allOffers]);
  const doneList = useMemo(
    () => allOffers.filter((offer) => offer.status === "COMPLETED"),
    [allOffers],
  );

  const selectGive = (asset: CryptoAsset) => {
    if (asset === receiveAsset) setReceiveAsset(asset === "USDT" ? "BTC" : "USDT");
    setGiveAsset(asset);
    setPickerOpen(null);
    setTab("offers");
  };
  const selectReceive = (asset: CryptoAsset) => {
    if (asset === giveAsset) setGiveAsset(asset === "USDT" ? "BTC" : "USDT");
    setReceiveAsset(asset);
    setPickerOpen(null);
    setTab("offers");
  };
  const switchAssets = () => {
    setGiveAsset(receiveAsset);
    setReceiveAsset(giveAsset);
    setGiveAmount("");
    setPickerOpen(null);
    setTab("offers");
  };

  const openPicker = (target: "give" | "receive") => {
    setPickerOpen((prev) => (prev === target ? null : target));
    setPickerQuery("");
  };
  const currentPickerOptions = CRYPTO_ASSETS.filter(
    (asset) => asset !== (pickerOpen === "give" ? receiveAsset : giveAsset),
  );
  const filteredPickerOptions = currentPickerOptions.filter((asset) => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return true;
    return asset.toLowerCase().includes(q) || ASSET_META[asset].fullName.toLowerCase().includes(q);
  });

  return (
    <PhoneShell>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-foreground">교환</div>
            <div className="truncate text-[10px] font-semibold text-muted-foreground">
              코인 간 P2P 교환
            </div>
          </div>
        </div>
        <span className="rounded-full bg-primary-soft px-2 py-1 text-[10px] font-bold text-primary">
          Crypto P2P
        </span>
      </header>

      <div className="border-b border-border bg-card px-4 py-2.5">
        <div className="space-y-2 rounded-2xl border border-border bg-background p-2.5 shadow-sm">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <SwapActionButton
              label="내가 줄 것 선택"
              value={giveAsset}
              active={pickerOpen === "give"}
              onClick={() => openPicker("give")}
            />
            <button
              onClick={switchAssets}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background"
              aria-label="주는 것과 받을 것 바꾸기"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
            <SwapActionButton
              label="내가 받을 것 선택"
              value={receiveAsset}
              active={pickerOpen === "receive"}
              onClick={() => openPicker("receive")}
            />
          </div>

          {pickerOpen && (
            <div className="rounded-2xl border border-border bg-background p-2 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[12px] font-extrabold text-foreground">
                    {pickerOpen === "give" ? "내가 줄 것 선택" : "내가 받을 것 선택"}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground">
                    검색해서 코인을 선택하세요
                  </div>
                </div>
                <button
                  onClick={() => setPickerOpen(null)}
                  className="rounded-full bg-surface px-2 py-1 text-[10px] font-bold text-muted-foreground"
                >
                  닫기
                </button>
              </div>
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="코인명 검색"
                className="mb-2 h-9 w-full rounded-xl bg-surface px-3 text-[12px] font-bold text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
                {filteredPickerOptions.map((asset) => (
                  <button
                    key={asset}
                    onClick={() =>
                      pickerOpen === "give" ? selectGive(asset) : selectReceive(asset)
                    }
                    className="flex h-11 w-full items-center justify-between rounded-xl bg-card px-3 text-left active:scale-[0.99]"
                  >
                    <span className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-[11px] text-primary">
                        {ASSET_META[asset].badge}
                      </span>
                      <span>
                        <span className="block text-[13px] font-extrabold text-foreground">
                          {asset}
                        </span>
                        <span className="block text-[10px] font-bold text-muted-foreground">
                          {ASSET_META[asset].fullName}
                        </span>
                      </span>
                    </span>
                    <span className="text-[11px] font-extrabold text-primary">선택</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-1.5">
            <label className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                <span>{giveAsset} 수량 입력</span>
                <span>교환</span>
              </div>
              <input
                value={giveAmount}
                onChange={(e) => setGiveAmount(e.target.value.replace(/[^\d.]/g, ""))}
                inputMode="decimal"
                placeholder={`보낼 ${giveAsset} 수량`}
                className="num-display h-7 w-full bg-transparent text-[16px] font-extrabold text-foreground outline-none"
              />
            </label>
            <div className="min-w-[108px] rounded-xl bg-surface px-3 py-2 text-right">
              <div className="text-[10px] font-bold text-muted-foreground">예상 수령</div>
              <div className="num-display h-7 text-[13px] font-extrabold text-foreground">
                {fairReceive ? fmtNum(fairReceive, 6) : "0"}
              </div>
              <div className="text-[10px] font-bold text-muted-foreground">{receiveAsset}</div>
            </div>
          </div>

          <Link
            to="/app/swap/new"
            search={{ give: giveAsset, receive: receiveAsset, amount: giveAmount }}
            className="flex h-10 items-center justify-center gap-1 rounded-xl bg-foreground px-3 text-[12px] font-extrabold text-background"
          >
            <Plus className="h-3.5 w-3.5" /> 교환 오퍼 등록
          </Link>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="truncate text-[16px] font-extrabold text-foreground">
              {giveAsset} → {receiveAsset}
            </span>
            <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
              {visibleOffers.length}건
            </span>
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SwapSortKey)}
            className="h-8 shrink-0 rounded-lg border border-border bg-background px-2 text-[11px] font-bold text-foreground outline-none"
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-surface p-1">
          <TabButton
            active={tab === "offers"}
            label="오퍼"
            count={visibleOffers.length}
            onClick={() => setTab("offers")}
          />
          <TabButton
            active={tab === "my"}
            label="내 오퍼"
            count={myOffers.length}
            onClick={() => setTab("my")}
          />
          <TabButton
            active={tab === "done"}
            label="완료"
            count={doneList.length}
            onClick={() => setTab("done")}
          />
        </div>
      </div>

      {tab === "offers" && (
        <div className="px-4 pt-3">
          {visibleOffers.length === 0 ? (
            <EmptySwap give={giveAsset} receive={receiveAsset} amount={giveAmount} />
          ) : (
            <div className="space-y-2">
              {visibleOffers.map((offer, index) => (
                <SwapOfferCard
                  key={offer.id}
                  offer={offer}
                  give={giveAsset}
                  receive={receiveAsset}
                  prices={prices}
                  rank={index + 1}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "my" && (
        <div className="px-4 pt-3 space-y-2">
          {myOffers.length ? (
            myOffers.map((offer) => (
              <SwapOfferCard
                key={offer.id}
                offer={offer}
                give={offer.fromAsset}
                receive={offer.toAsset}
                prices={prices}
                rank={0}
                mode="mine"
              />
            ))
          ) : (
            <EmptyBox text="등록한 교환 오퍼가 없습니다." />
          )}
        </div>
      )}
      {tab === "done" && (
        <div className="px-4 pt-3 space-y-2">
          {doneList.length ? (
            doneList.map((offer) => (
              <SwapOfferCard
                key={offer.id}
                offer={offer}
                give={offer.fromAsset}
                receive={offer.toAsset}
                prices={prices}
                rank={0}
                mode="done"
              />
            ))
          ) : (
            <EmptyBox text="완료된 교환 오퍼가 없습니다." />
          )}
        </div>
      )}
      <div className="h-6" />
    </PhoneShell>
  );
}

function TabButton({
  active,
  label,
  count,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-lg py-2 text-[11px] font-extrabold ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
    >
      {label} <span className="num-display">{count}</span>
    </button>
  );
}

function SwapActionButton({
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
      className={`flex h-10 items-center justify-center rounded-xl px-2 text-center text-[12px] font-extrabold ${active ? "bg-primary text-primary-foreground" : "bg-foreground text-background"}`}
    >
      <span>{label}</span>
      <span className="ml-1.5 rounded-full bg-background/15 px-1.5 py-0.5 text-[10px]">
        {value}
      </span>
    </button>
  );
}

function SwapOfferCard({
  offer,
  give,
  receive,
  prices,
  rank,
  mode = "take",
}: {
  offer: CryptoSwapOffer;
  give: CryptoAsset;
  receive: CryptoAsset;
  prices: Record<CryptoAsset, number>;
  rank: number;
  mode?: "take" | "mine" | "done";
}) {
  const direct = offer.fromAsset === give && offer.toAsset === receive;
  const giveAmount = direct ? offer.fromAmount : offer.toAmount;
  const receiveAmount = direct ? offer.toAmount : offer.fromAmount;
  const remain = Math.max(0, offer.fromAmount - offer.filledFromAmount);
  const advantage = offerAdvantagePct(offer, give, receive, prices);
  const isBest = rank === 1 || advantage > 0;
  return (
    <div
      className={`rounded-xl border bg-card px-3 py-2 shadow-sm ${isBest && mode === "take" ? "border-success" : offer.isMine ? "border-primary" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[12px] font-extrabold text-foreground">
            {offer.ownerIsMerchant && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
            <span>{offer.ownerName}</span>
          </div>
          <div className="mt-0.5 text-[10px] font-semibold text-muted-foreground">
            Lv.{offer.ownerLevel} · {offer.expectedFillSec ?? "--"}초
          </div>
          <div className="mt-1 flex flex-wrap gap-1">
            {isBest && mode === "take" && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-success px-1.5 py-0.5 text-[10px] font-extrabold text-success-foreground">
                <Sparkles className="h-2.5 w-2.5" /> BEST
              </span>
            )}
            <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
              {offer.fromAsset} → {offer.toAsset}
            </span>
          </div>
        </div>
        <Link
          to="/app/swap/order/new/$offerId"
          params={{ offerId: offer.id }}
          className={`rounded-lg px-2.5 py-1.5 text-[12px] font-extrabold ${mode === "take" && !offer.isMine ? "bg-primary text-primary-foreground" : "bg-surface text-muted-foreground"}`}
        >
          {offer.isMine ? "내 오퍼" : mode === "done" ? "완료" : "교환"}
        </Link>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <div className="rounded-lg bg-surface px-2 py-1.5">
          <div className="text-[10px] font-bold text-muted-foreground">줌</div>
          <div className="num-display text-[14px] font-extrabold text-foreground">
            {fmtNum(giveAmount, 6)} {give}
          </div>
        </div>
        <div className="rounded-lg bg-primary-soft px-2 py-1.5 text-primary">
          <div className="text-[10px] font-bold">받음</div>
          <div className="num-display text-[14px] font-extrabold">
            {fmtNum(receiveAmount, 6)} {receive}
          </div>
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
        <span
          className={`font-extrabold ${advantage > 0 ? "text-success" : "text-muted-foreground"}`}
        >
          {advantage > 0 ? `${advantage.toFixed(2)}% 유리` : `기준 ${advantage.toFixed(2)}%`}
        </span>
        <span className="ml-auto font-bold text-muted-foreground">
          잔여 {fmtNum(remain, 6)} {offer.fromAsset}
        </span>
      </div>
    </div>
  );
}

function EmptySwap({
  give,
  receive,
  amount,
}: {
  give: CryptoAsset;
  receive: CryptoAsset;
  amount: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center">
      <div className="text-[13px] font-extrabold text-foreground">
        조건에 맞는 교환 오퍼가 없습니다
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">
        원하는 비율로 오퍼를 등록하면 상대방이 직접 참여할 수 있습니다.
      </p>
      <Link
        to="/app/swap/new"
        search={{ give, receive, amount }}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2.5 text-[12px] font-extrabold text-background"
      >
        <Plus className="h-3.5 w-3.5" /> 교환 오퍼 등록
      </Link>
    </div>
  );
}

function EmptyBox({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card py-10 text-center text-[12px] text-muted-foreground">
      {text}
    </div>
  );
}
