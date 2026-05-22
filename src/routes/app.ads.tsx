import { createFileRoute, Link } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2, Plus, ArrowRight } from "lucide-react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { useState } from "react";
import { useOffers, type OfferSide } from "@/hooks/useOffers";

const search = z.object({ side: z.enum(["sell", "buy"]).optional() });

export const Route = createFileRoute("/app/ads")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "오퍼 보드 — EXPEER" }] }),
  component: OfferBoard,
});

function fmtKrw(n: number) {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}
function fmtNum(n: number) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
}
function paymentLabel(method: string) {
  if (method === "bank_transfer") return "계좌이체";
  if (method === "toss") return "토스";
  if (method === "kakao_pay") return "카카오페이";
  if (method === "onchain") return "온체인";
  return method;
}

function OfferBoard() {
  const initial = Route.useSearch();
  const [side, setSide] = useState<OfferSide>(initial.side ?? "sell");
  const [asset, setAsset] = useState<string>("ALL");
  const { offers, loading } = useOffers({
    side,
    asset: asset === "ALL" ? undefined : asset,
    fiat: "KRW",
  });

  return (
    <PhoneShell>
      <AppHeader
        title="오퍼 보드"
        subtitle="P2P환전 오퍼를 빠르게 확인"
        right={
          <Link
            to="/app/selling/new"
            className="inline-flex items-center gap-1 rounded-full bg-primary px-3 py-1.5 text-[11px] font-bold text-primary-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> 등록
          </Link>
        }
      />

      <div className="px-4 pt-1">
        <div className="flex rounded-xl bg-surface p-1">
          <button
            onClick={() => setSide("sell")}
            className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition ${side === "sell" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            사기 좋은 오퍼
          </button>
          <button
            onClick={() => setSide("buy")}
            className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition ${side === "buy" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            팔기 좋은 오퍼
          </button>
        </div>

        <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
          {["ALL", "USDT", "USDC", "DAI"].map((a) => (
            <button
              key={a}
              onClick={() => setAsset(a)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ${asset === a ? "bg-primary text-primary-foreground" : "bg-surface text-foreground"}`}
            >
              {a === "ALL" ? "전체" : a}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 px-4 pb-6 pt-3">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : offers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface py-12 text-center text-[13px] text-muted-foreground">
            조건에 맞는 오퍼가 없습니다.
          </div>
        ) : (
          offers.map((o) => (
            <Link
              key={o.id}
              to="/app/ads/$adId"
              params={{ adId: o.id }}
              className="card-lift block rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[13px] font-bold text-foreground">
                    {o.asset}{" "}
                    <span className="text-[11px] font-semibold text-muted-foreground">
                      · {o.network}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("ko-KR")}
                  </div>
                </div>
                <div className="text-right">
                  <div className="num-display text-xl text-foreground">
                    {fmtKrw(Number(o.price))}
                  </div>
                  <div className="text-[11px] text-muted-foreground">/ 1 {o.asset}</div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                <div className="rounded-lg bg-surface px-2.5 py-1.5">
                  <div className="text-muted-foreground">가능 수량</div>
                  <div className="num-tnum font-semibold text-foreground">
                    {fmtNum(Number(o.available_amount))} {o.asset}
                  </div>
                </div>
                <div className="rounded-lg bg-surface px-2.5 py-1.5">
                  <div className="text-muted-foreground">거래 한도</div>
                  <div className="num-tnum font-semibold text-foreground">
                    {fmtKrw(Number(o.min_order))} ~ {fmtKrw(Number(o.max_order))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {o.payment_methods.map((p) => (
                  <span
                    key={p}
                    className="rounded-md bg-surface-strong px-1.5 py-0.5 text-[10px] font-medium text-foreground"
                  >
                    {paymentLabel(p)}
                  </span>
                ))}
                <div className="ml-auto inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground">
                  거래 <ArrowRight className="h-3 w-3" />
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </PhoneShell>
  );
}
