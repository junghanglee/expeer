import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { DepthMiniChart } from "@/components/espeer/DepthMiniChart";
import { LivePriceBar } from "@/components/espeer/LivePriceBar";
import { useLivePrices } from "@/hooks/useLivePrices";
import { MarketPairPicker } from "@/components/espeer/PairPicker";
import {
  ArrowLeft,
  ShieldCheck,
  Info,
  BadgeCheck,
  Zap,
  Clock,
  CheckCircle2,
  CircleDot,
  Plus,
  Sparkles,
} from "lucide-react";
import {
  fmtNum,
  fmtKrw,
  makePairStats,
  type SwapPair,
  type SwapSide,
  type SwapRequest,
} from "@/data/format";
import { useSwapRequests } from "@/data/offerStore";

export const Route = createFileRoute("/app/market")({
  head: () => ({
    meta: [
      { title: "P2P 환전소 — EXPEER" },
      {
        name: "description",
        content:
          "선택한 페어에서 즉시 살 수 있는 오퍼를 한눈에. 전체구매 또는 부분구매가 가능한 P2P 환전소.",
      },
    ],
  }),
  component: MarketPage,
});

type Tab = "buy" | "sell" | "myorders" | "done";
type SortKey = "best" | "newest" | "volume";
const PAIRS: SwapPair[] = ["USDT/KRW", "USDC/KRW", "USDT/USD"];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "best", label: "유리한 가격순" },
  { key: "newest", label: "최신순" },
  { key: "volume", label: "거래량순" },
];

// DB에 오퍼가 없을 때 시세 기준값으로만 사용한다.
function fallbackMidPrice(pair: SwapPair) {
  if (pair === "USDT/KRW" || pair === "USDC/KRW") return 1380;
  return 1;
}

// 프로필 기본 페어 — 실제 서비스에서는 user 컨텍스트, 여기선 localStorage 시뮬
function readDefaultPair(): SwapPair {
  if (typeof window === "undefined") return "USDT/KRW";
  const v = window.localStorage.getItem("expeer.defaultPair") as SwapPair | null;
  return v && PAIRS.includes(v) ? v : "USDT/KRW";
}

function MarketPage() {
  const [pair, setPair] = useState<SwapPair>("USDT/KRW");
  const [tab, setTab] = useState<Tab>("buy");
  const [sort, setSort] = useState<SortKey>("best");

  const allOffers = useSwapRequests();

  // hydrate default pair from profile
  useEffect(() => {
    setPair(readDefaultPair());
  }, []);

  const base = pair.split("/")[0];
  const fiat = pair.split("/")[1] as "KRW" | "USD";
  // 글로벌 시세에서 라이브 가격을 가져오고, 실패 시 DB 오퍼 기반 기준가를 사용한다.
  const live = useLivePrices([base]);
  const liveQuote = live.quotes[base];
  const livePrice = liveQuote ? (fiat === "KRW" ? liveQuote.priceKrw : liveQuote.priceUsd) : null;
  const mid = livePrice ?? makePairStats(pair, allOffers, fallbackMidPrice(pair)).midPrice;

  // 정렬 적용 함수: best는 side에 따라 다름
  const applySort = (arr: SwapRequest[], side: SwapSide) => {
    const out = [...arr];
    if (sort === "newest") {
      out.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } else if (sort === "volume") {
      out.sort((a, b) => b.amountToken - a.amountToken);
    } else {
      // best: 구매탭(sell offers) → 단가 낮은순 / 판매탭(buy offers) → 단가 높은순
      out.sort((a, b) => (side === "sell" ? a.unitPrice - b.unitPrice : b.unitPrice - a.unitPrice));
    }
    return out;
  };

  // sell side 오퍼 (구매탭에서 보임)
  const sellOffers = useMemo(
    () =>
      applySort(
        allOffers.filter((s) => s.pair === pair && s.side === "sell"),
        "sell",
      ),
    [pair, sort, allOffers],
  );
  // buy side 오퍼 (판매탭에서 보임)
  const buyOffers = useMemo(
    () =>
      applySort(
        allOffers.filter((s) => s.pair === pair && s.side === "buy"),
        "buy",
      ),
    [pair, sort, allOffers],
  );

  const myList = useMemo(
    () => allOffers.filter((s) => s.pair === pair && s.isMine),
    [pair, allOffers],
  );

  const doneList = useMemo(
    () => allOffers.filter((s) => s.pair === pair && s.status === "COMPLETED"),
    [pair, allOffers],
  );

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
            <div className="text-[15px] font-extrabold text-foreground">P2P 환전</div>
            <div className="truncate text-[10px] font-semibold text-muted-foreground">
              스테이블코인 ↔ 법정화폐
            </div>
          </div>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-bold text-success">
          <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" />
          LIVE
        </div>
      </header>

      {/* Pair selector — 바이낸스 P2P 스타일: 코인/통화 직접 선택 */}
      <MarketPairPicker pair={pair} onChange={setPair} />

      {/* 글로벌 시세 (CoinMarketCap) */}
      <LivePriceBar symbol={pair.split("/")[0]} fiat={pair.split("/")[1] as "KRW" | "USD"} />

      {/* P2P 시장 현황 — 활성 판매자/구매자, 가격대별 오퍼 분포 */}
      <DepthMiniChart pair={pair} offers={allOffers} />

      {/* Quick action buttons */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/app/selling/new"
          search={{ side: "buy", asset: base }}
          className="card-lift flex items-center justify-center gap-2 rounded-2xl bg-success px-3 py-3 text-success-foreground"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="truncate text-[13px] font-extrabold">{base} 구매 오퍼 등록</span>
        </Link>
        <Link
          to="/app/selling/new"
          search={{ side: "sell", asset: base }}
          className="card-lift flex items-center justify-center gap-2 rounded-2xl bg-destructive px-3 py-3 text-destructive-foreground"
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className="truncate text-[13px] font-extrabold">{base} 판매 오퍼 등록</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="mt-3 flex gap-1 px-4">
        <TabBtn active={tab === "buy"} onClick={() => setTab("buy")}>
          <span className="text-success">●</span> 구매{" "}
          <span className="ml-0.5 text-[11px] opacity-70">{sellOffers.length}</span>
        </TabBtn>
        <TabBtn active={tab === "sell"} onClick={() => setTab("sell")}>
          <span className="text-destructive">●</span> 판매{" "}
          <span className="ml-0.5 text-[11px] opacity-70">{buyOffers.length}</span>
        </TabBtn>
        <TabBtn active={tab === "myorders"} onClick={() => setTab("myorders")}>
          내 오퍼 <span className="ml-0.5 text-[11px] opacity-70">{myList.length}</span>
        </TabBtn>
        <TabBtn active={tab === "done"} onClick={() => setTab("done")}>
          완료
        </TabBtn>
      </div>

      {/* Sort filter — 구매/판매 탭에서만 노출 */}
      {(tab === "buy" || tab === "sell") && (
        <div className="mt-2 flex items-center gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SORT_OPTIONS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition-colors ${
                sort === s.key
                  ? "bg-foreground text-background"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
          <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] font-semibold text-muted-foreground">
            기준 {fmtNum(mid)} {pair.split("/")[1]}
          </span>
        </div>
      )}

      {/* Content */}
      {tab === "buy" && (
        <div className="px-4 pt-3">
          <SectionHeader
            title="지금 구매할 수 있는 판매자 오퍼"
            sub={`${sellOffers.length}건 · ${SORT_OPTIONS.find((o) => o.key === sort)!.label}`}
            tone="buy"
          />
          {sellOffers.length === 0 ? (
            <EmptyOffer side="sell" />
          ) : (
            <div className="space-y-2">
              {sellOffers.map((req) => (
                <OfferCard key={req.id} req={req} mode="take-buy" midPrice={mid} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "sell" && (
        <div className="px-4 pt-3">
          <SectionHeader
            title="지금 판매할 수 있는 구매자 오퍼"
            sub={`${buyOffers.length}건 · ${SORT_OPTIONS.find((o) => o.key === sort)!.label}`}
            tone="sell"
          />
          {buyOffers.length === 0 ? (
            <EmptyOffer side="buy" />
          ) : (
            <div className="space-y-2">
              {buyOffers.map((req) => (
                <OfferCard key={req.id} req={req} mode="take-sell" midPrice={mid} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "myorders" && (
        <div className="px-4 pt-3">
          {myList.length === 0 ? (
            <EmptyMine />
          ) : (
            <div className="space-y-2">
              {myList.map((req) => (
                <OfferCard key={req.id} req={req} mode="mine" midPrice={mid} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "done" && (
        <div className="px-4 pt-3">
          {doneList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card py-10 text-center text-[12px] text-muted-foreground">
              체결된 거래가 아직 없어요.
            </div>
          ) : (
            <div className="space-y-2">
              {doneList.map((req) => (
                <OfferCard key={req.id} req={req} mode="done" midPrice={mid} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="h-6" />
    </PhoneShell>
  );
}

/* PairSelector 제거됨 — MarketPairPicker(코인+통화 직접 선택)로 대체 */

/* PairSummary 제거 — DepthMiniChart에 통합되었습니다 */

/* ============== Tabs / chips ============== */
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

function SectionHeader({ title, sub, tone }: { title: string; sub: string; tone: "buy" | "sell" }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <div className="flex items-center gap-1.5">
        <span
          className={`h-1.5 w-1.5 rounded-full ${tone === "buy" ? "bg-success" : "bg-destructive"}`}
        />
        <span className="text-[12px] font-extrabold text-foreground">{title}</span>
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground">{sub}</span>
    </div>
  );
}

/* ============== Offer Card with partial slider ============== */
type OfferMode = "take-buy" | "take-sell" | "mine" | "done";

function OfferCard({
  req,
  mode,
  midPrice,
}: {
  req: SwapRequest;
  mode: OfferMode;
  midPrice: number;
}) {
  const navigate = useNavigate();
  const isSell = req.side === "sell";
  const base = req.pair.split("/")[0];
  const quote = req.pair.split("/")[1];
  const remain = req.amountToken - req.filledToken;
  const fillPct = Math.round((req.filledToken / req.amountToken) * 100);

  const isTake = mode === "take-buy" || mode === "take-sell";
  const [pick, setPick] = useState<number>(remain);
  const [open, setOpen] = useState(false);

  const unit = req.isMarket ? midPrice : req.unitPrice;
  const totalQuote = unit * pick;

  // 시세 대비 프리미엄(%) — 시장가는 표시 생략
  const premium =
    !req.isMarket && midPrice > 0 ? ((req.unitPrice - midPrice) / midPrice) * 100 : null;
  // "유리한가": 구매자(take-buy)는 단가↓ 좋음 / 판매자(take-sell)는 단가↑ 좋음
  // 내가 구매측이면 sell-offer가 시세 이하일 때 유리, 판매측이면 buy-offer가 시세 이상일 때 유리
  const favorable =
    premium === null
      ? null
      : mode === "take-buy" || (mode === "mine" && req.side === "buy")
        ? premium <= 0
        : premium >= 0;

  // tone for the action button
  const actionTone =
    mode === "take-buy"
      ? "bg-success text-success-foreground"
      : mode === "take-sell"
        ? "bg-destructive text-destructive-foreground"
        : "bg-foreground text-background";

  return (
    <div
      className={`card-lift rounded-2xl border bg-card p-3 ${
        mode === "mine" ? "border-primary ring-2 ring-primary/30" : "border-border"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              isSell ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
            }`}
          >
            {isSell ? "판매중" : "매수중"}
          </span>
          {req.isMarket && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
              <Zap className="h-2.5 w-2.5" /> 시장가
            </span>
          )}
          {mode === "mine" && (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-bold text-background">
              <Sparkles className="h-2.5 w-2.5" /> 내 주문
            </span>
          )}
          <StatusBadge status={req.status} />
        </div>
        <div className="text-right">
          <div className="num-display text-[16px] text-foreground">
            {req.isMarket ? "시장가" : fmtNum(req.unitPrice)}
          </div>
          <div className="flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
            <span>
              {quote} / 1 {base}
            </span>
            {premium !== null && (
              <span
                className={`whitespace-nowrap rounded px-1 py-0.5 font-bold ${
                  favorable
                    ? "bg-success-soft text-success"
                    : "bg-destructive-soft text-destructive"
                }`}
                title={`시세 ${fmtNum(midPrice)} 대비`}
              >
                {premium >= 0 ? "+" : ""}
                {premium.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
        <div>
          <div className="text-muted-foreground">잔여 수량</div>
          <div className="num-display mt-0.5 text-[13px] text-foreground">
            {fmtNum(remain)} {base}
          </div>
          <div className="text-[10px] text-muted-foreground">총 {fmtNum(req.amountToken)}</div>
        </div>
        <div className="text-right">
          <div className="text-muted-foreground">최대 체결액</div>
          <div className="num-display mt-0.5 text-[13px] text-foreground">
            {fmtKrw(Math.round(unit * remain))}
          </div>
        </div>
      </div>

      {/* progress */}
      {req.filledToken > 0 && mode !== "done" && (
        <div className="mt-2">
          <div className="h-1 overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-primary transition-all" style={{ width: `${fillPct}%` }} />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{fillPct}% 체결됨</span>
            {req.expectedFillSec && (
              <span className="inline-flex items-center gap-0.5">
                <Clock className="h-3 w-3" /> 예상 잔여 {req.expectedFillSec}초
              </span>
            )}
          </div>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-border pt-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          {req.ownerIsMerchant && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
          <span className="font-semibold text-foreground/80">{req.ownerName}</span>
          <span className="text-[10px]">Lv.{req.ownerLevel}</span>
        </div>
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          {req.banks.slice(0, 2).map((b) => (
            <span key={b} className="rounded bg-surface px-1.5 py-0.5">
              {b}
            </span>
          ))}
          {req.banks.length > 2 && <span>+{req.banks.length - 2}</span>}
        </div>
      </div>

      {/* Take action with partial buy slider */}
      {isTake && (
        <>
          {!open ? (
            <button
              onClick={() => setOpen(true)}
              className={`mt-2.5 w-full whitespace-nowrap rounded-xl py-2 text-[12px] font-extrabold transition-opacity hover:opacity-90 ${actionTone}`}
            >
              {mode === "take-buy" ? "매수" : "매도"} · {fmtNum(remain)} {base}
            </button>
          ) : (
            <div className="mt-3 rounded-xl bg-surface p-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-foreground">
                <span>구매 수량 선택</span>
                <span className="num-display text-[14px] text-primary">
                  {fmtNum(pick)} {base}
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={remain}
                step={1}
                value={pick}
                onChange={(e) => setPick(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
              />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                <span>1</span>
                <span>{fmtNum(remain)}</span>
              </div>

              {/* 빠른 비율 */}
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {[25, 50, 75, 100].map((pc) => (
                  <button
                    key={pc}
                    onClick={() => setPick(Math.max(1, Math.round((remain * pc) / 100)))}
                    className={`rounded-lg py-1 text-[10px] font-bold ${
                      pick === Math.round((remain * pc) / 100)
                        ? "bg-primary text-primary-foreground"
                        : "bg-card text-muted-foreground"
                    }`}
                  >
                    {pc}%
                  </button>
                ))}
              </div>

              <div className="mt-3 flex items-center justify-between rounded-lg bg-card px-3 py-2">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {mode === "take-buy" ? "지불 금액" : "수령 금액"}
                </span>
                <span className="num-display text-[14px] text-foreground">
                  {fmtKrw(Math.round(totalQuote))}
                </span>
              </div>

              <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-primary" />
                컨트랙트가 {fmtNum(pick)} {base}만 정확히 락업합니다.
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded-xl bg-card py-2 text-[12px] font-bold text-muted-foreground"
                >
                  취소
                </button>
                <button
                  onClick={() => navigate({ to: "/app/order/new/$adId", params: { adId: req.id } })}
                  className={`flex-2 flex-1 rounded-xl py-2 text-[12px] font-extrabold ${actionTone}`}
                >
                  {pick === remain ? "전체" : "부분"}{" "}
                  {mode === "take-buy" ? "매수 진행" : "매도 진행"}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {mode === "done" && (
        <div className="mt-2 flex items-center gap-1 text-[10px] text-success">
          <CheckCircle2 className="h-3 w-3" /> {req.expectedFillSec}초만에 체결 완료 ·{" "}
          {req.createdAt}
        </div>
      )}
      {mode === "mine" && (
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <button className="rounded-xl bg-surface py-2 text-[11px] font-bold text-muted-foreground">
            가격 수정
          </button>
          <button className="rounded-xl bg-destructive-soft py-2 text-[11px] font-bold text-destructive">
            주문 취소
          </button>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SwapRequest["status"] }) {
  const map = {
    OPEN: { label: "대기중", cls: "bg-surface text-muted-foreground" },
    MATCHING: { label: "매칭중", cls: "bg-warning-soft text-warning" },
    IN_ESCROW: { label: "에스크로", cls: "bg-primary-soft text-primary" },
    COMPLETED: { label: "완료", cls: "bg-success-soft text-success" },
    CANCELLED: { label: "취소", cls: "bg-surface text-muted-foreground" },
  } as const;
  const m = map[status];
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${m.cls}`}
    >
      <CircleDot className="h-2.5 w-2.5" /> {m.label}
    </span>
  );
}

/* ============== Empty states ============== */
function EmptyOffer({ side }: { side: SwapSide }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card py-6 text-center">
      <Info className="mx-auto h-4 w-4 text-muted-foreground" />
      <div className="mt-2 text-[12px] font-bold text-foreground">
        지금 {side === "sell" ? "살 수" : "팔 수"} 있는 오퍼가 없어요
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">
        직접 주문을 등록하면 매칭을 기다릴 수 있어요.
      </div>
    </div>
  );
}

function EmptyMine() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card py-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface">
        <Info className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-3 text-[13px] font-bold text-foreground">아직 등록한 주문이 없어요</div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        상단의 매수/매도 버튼으로 주문을 올려보세요.
      </div>
    </div>
  );
}
