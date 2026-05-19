import { useMemo, useState } from "react";
import { Users, TrendingUp, TrendingDown, Lock, X } from "lucide-react";
import { MOCK_PAIR_STATS, fmtNum, fmtKrw, type SwapPair, type SwapRequest } from "@/data/mock";

/**
 * P2P 시장 현황 — 활성 판매자/구매자 인원 + 가격대별 오퍼 분포.
 * `offers`는 DB+mock이 합쳐진 실제 오퍼 목록을 받아서 호가/참여자 수를 계산한다.
 */
export function DepthMiniChart({ pair, offers }: { pair: SwapPair; offers: SwapRequest[] }) {
  const stats = MOCK_PAIR_STATS[pair];
  const base = pair.split("/")[0];
  const quote = pair.split("/")[1];
  const up = stats.change24h >= 0;
  const [showCustody, setShowCustody] = useState(false);

  const { sellers, buyers, sellLevels, buyLevels, totalSellRemain, totalBuyRemain } =
    useMemo(() => {
      const open = offers.filter((s) => s.pair === pair && s.status === "OPEN");
      const sells = open.filter((s) => s.side === "sell");
      const buys = open.filter((s) => s.side === "buy");
      const remain = (s: (typeof open)[number]) => Math.max(0, s.amountToken - s.filledToken);
      const groupBy = (arr: typeof sells, dir: "asc" | "desc") => {
        const map = new Map<number, number>();
        arr.forEach((s) => {
          const p = s.isMarket ? stats.midPrice : s.unitPrice;
          map.set(p, (map.get(p) ?? 0) + remain(s));
        });
        return Array.from(map.entries())
          .sort((a, b) => (dir === "asc" ? a[0] - b[0] : b[0] - a[0]))
          .slice(0, 4)
          .map(([price, qty]) => ({ price, qty }));
      };
      return {
        sellers: new Set(sells.map((s) => s.ownerName)).size,
        buyers: new Set(buys.map((s) => s.ownerName)).size,
        sellLevels: groupBy(sells, "asc"),
        buyLevels: groupBy(buys, "desc"),
        totalSellRemain: sells.reduce((a, b) => a + remain(b), 0),
        totalBuyRemain: buys.reduce((a, b) => a + remain(b), 0),
      };
    }, [pair, stats.midPrice, offers]);

  const maxLevel = Math.max(1, ...sellLevels.map((l) => l.qty), ...buyLevels.map((l) => l.qty));
  const total = totalBuyRemain + totalSellRemain;
  const buyPct = total ? Math.round((totalBuyRemain / total) * 100) : 50;
  const sellPct = 100 - buyPct;

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-border bg-card p-3">
      {/* 상단: 시세 + 비수탁 아이콘 */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-baseline gap-1.5">
            <span className="num-display text-[22px] leading-none text-foreground">
              {fmtNum(stats.midPrice)}
            </span>
            <span className="text-[10px] font-bold text-muted-foreground">
              {quote}/1{base}
            </span>
            <span
              className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                up ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
              }`}
            >
              {up ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <TrendingDown className="h-2.5 w-2.5" />
              )}
              {up ? "+" : ""}
              {stats.change24h.toFixed(2)}%
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <span>
              오늘 <span className="num-display text-foreground">{fmtNum(stats.todayDeals)}</span>건
            </span>
            <span>·</span>
            <span>
              평균 <span className="num-display text-foreground">{stats.avgFillSec}</span>초
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowCustody(true)}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary hover:bg-primary hover:text-primary-foreground"
          title="비수탁(Zero-Custody) 안내"
          aria-label="비수탁 거래 안내"
        >
          <Lock className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 참여자 요약 — 호가창 아닌 "지금 거래 중인 사람들" */}
      <div className="mt-2 flex items-center justify-between text-[10px] font-bold">
        <div className="flex items-center gap-1 text-success">
          <Users className="h-3 w-3" />
          <span>구매자 {buyers}명</span>
          <span className="text-muted-foreground">·</span>
          <span className="num-display">{fmtNum(totalBuyRemain)}</span>
          <span className="text-muted-foreground">{base} 모집중</span>
        </div>
        <div className="flex items-center gap-1 text-destructive">
          <span className="text-muted-foreground">{base} 판매중</span>
          <span className="num-display">{fmtNum(totalSellRemain)}</span>
          <span className="text-muted-foreground">·</span>
          <span>판매자 {sellers}명</span>
          <Users className="h-3 w-3" />
        </div>
      </div>

      <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-surface">
        <div className="h-full bg-success/70" style={{ width: `${buyPct}%` }} />
        <div className="h-full bg-destructive/70" style={{ width: `${sellPct}%` }} />
      </div>

      {/* 가격대별 오퍼 (거래소의 호가창이 아니라 사람들이 제시한 단가 분포) */}
      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
        <div>
          <div className="mb-1 px-1 text-[10px] font-bold text-success">구매 희망가</div>
          <div className="space-y-0.5">
            {buyLevels.length === 0 && (
              <div className="text-center text-[10px] text-muted-foreground">없음</div>
            )}
            {buyLevels.map((l) => (
              <DepthRow
                key={`b-${l.price}`}
                side="buy"
                price={l.price}
                qty={l.qty}
                base={base}
                ratio={l.qty / maxLevel}
              />
            ))}
          </div>
        </div>
        <div>
          <div className="mb-1 px-1 text-right text-[10px] font-bold text-destructive">
            판매 제시가
          </div>
          <div className="space-y-0.5">
            {sellLevels.length === 0 && (
              <div className="text-center text-[10px] text-muted-foreground">없음</div>
            )}
            {sellLevels.map((l) => (
              <DepthRow
                key={`s-${l.price}`}
                side="sell"
                price={l.price}
                qty={l.qty}
                base={base}
                ratio={l.qty / maxLevel}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 환산 금액 */}
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[10px] text-muted-foreground">
        <span className="num-display text-success/80">
          ≈{" "}
          {quote === "KRW"
            ? fmtKrw(Math.round(totalBuyRemain * stats.bestBuy))
            : `${fmtNum(totalBuyRemain * stats.bestBuy)} ${quote}`}
        </span>
        <span className="num-display text-destructive/80">
          ≈{" "}
          {quote === "KRW"
            ? fmtKrw(Math.round(totalSellRemain * stats.bestSell))
            : `${fmtNum(totalSellRemain * stats.bestSell)} ${quote}`}
        </span>
      </div>

      {showCustody && <CustodyModal onClose={() => setShowCustody(false)} />}
    </div>
  );
}

function DepthRow({
  side,
  price,
  qty,
  base,
  ratio,
}: {
  side: "buy" | "sell";
  price: number;
  qty: number;
  base: string;
  ratio: number;
}) {
  const tone =
    side === "buy" ? "text-success bg-success-soft/60" : "text-destructive bg-destructive-soft/60";
  const align = side === "buy" ? "justify-end text-right" : "justify-start text-left";
  const barAlign = side === "buy" ? "right-0" : "left-0";
  return (
    <div className={`relative flex items-center ${align} h-5 overflow-hidden rounded-md`}>
      <div
        className={`absolute top-0 bottom-0 ${barAlign} ${tone}`}
        style={{ width: `${Math.max(8, ratio * 100)}%` }}
      />
      <div className="relative z-10 flex w-full items-center justify-between gap-2 px-1.5 text-[10px] font-bold">
        {side === "buy" ? (
          <>
            <span className="num-display text-muted-foreground">
              {fmtNum(qty)} {base}
            </span>
            <span className="num-display text-success">{fmtNum(price)}</span>
          </>
        ) : (
          <>
            <span className="num-display text-destructive">{fmtNum(price)}</span>
            <span className="num-display text-muted-foreground">
              {fmtNum(qty)} {base}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function CustodyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-[420px] rounded-t-3xl bg-background p-5 shadow-2xl sm:rounded-3xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border sm:hidden" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-soft text-primary">
              <Lock className="h-4 w-4" />
            </div>
            <div className="text-[15px] font-extrabold text-foreground">비수탁 거래</div>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-[12px] leading-relaxed text-foreground/80">
          EXPEER는 코인·원화를 직접 보관하지 않아요. 매칭 시점에 판매자 지갑에서 스마트 컨트랙트로
          정확한 수량만 락업되고, 양측 검증 후 컨트랙트가 매수자에게 직접 전송합니다.
        </p>
        <ul className="mt-3 space-y-2 text-[11px] text-foreground/70">
          <li className="flex gap-2">
            <span className="text-primary">①</span> Zero-Custody · 자산 미보관
          </li>
          <li className="flex gap-2">
            <span className="text-primary">②</span> On-chain Guarantee · 컨트랙트가 보증
          </li>
          <li className="flex gap-2">
            <span className="text-primary">③</span> P2P Verification · 사용자 서명으로 릴리즈
          </li>
        </ul>
        <button
          onClick={onClose}
          className="mt-4 w-full rounded-2xl bg-primary py-3 text-[13px] font-extrabold text-primary-foreground"
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}
