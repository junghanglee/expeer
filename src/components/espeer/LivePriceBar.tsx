import { useEffect, useRef, useState } from "react";
import { useLivePrice } from "@/hooks/useLivePrices";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";

type Props = {
  symbol: string; // e.g. "USDT"
  fiat?: "KRW" | "USD";
};

export function LivePriceBar({ symbol, fiat = "KRW" }: Props) {
  const { quote, loading, error } = useLivePrice(symbol);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);
  const lastPriceRef = useRef<number | null>(null);

  useEffect(() => {
    if (!quote) return;
    const cur = fiat === "KRW" ? quote.priceKrw : quote.priceUsd;
    const prev = lastPriceRef.current;
    if (prev !== null && prev !== cur) {
      setFlash(cur > prev ? "up" : "down");
      const t = setTimeout(() => setFlash(null), 700);
      lastPriceRef.current = cur;
      return () => clearTimeout(t);
    }
    lastPriceRef.current = cur;
  }, [quote, fiat]);

  if (loading) {
    return (
      <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        실시간 시세 로딩 중...
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="mx-4 mt-2 rounded-xl border border-border bg-surface px-3 py-2 text-[11px] text-muted-foreground">
        시세 정보를 가져올 수 없습니다
      </div>
    );
  }

  const price = fiat === "KRW" ? quote.priceKrw : quote.priceUsd;
  const fmtPrice =
    fiat === "KRW"
      ? `₩${price.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}`
      : `$${price.toFixed(4)}`;
  const isUp = quote.change24h >= 0;
  const flashCls =
    flash === "up"
      ? "bg-success-soft/60 ring-1 ring-success/40"
      : flash === "down"
        ? "bg-destructive-soft/60 ring-1 ring-destructive/40"
        : "bg-surface";

  return (
    <div
      className={`mx-4 mt-2 flex items-center justify-between rounded-xl border border-border px-3 py-2 transition-colors duration-500 ${flashCls}`}
    >
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary">
          LIVE
        </span>
        <span className="text-[11px] font-semibold text-muted-foreground">
          {symbol} 글로벌 시세
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="num-display text-[13px] font-bold text-foreground">{fmtPrice}</span>
        <span
          className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
            isUp ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
          }`}
        >
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isUp ? "+" : ""}
          {quote.change24h.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}
