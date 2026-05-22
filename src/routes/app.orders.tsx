import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { useOrders, type OrderWithAd } from "@/hooks/useOrders";
import type { Enums } from "@/integrations/supabase/types";

type OrderStatus = Enums<"order_status">;
type Tab = "active" | "done" | "dispute" | "cancelled";

const STATUS_LABEL: Record<OrderStatus, string> = {
  created: "주문 생성",
  info_shared: "정보 공유",
  paid: "송금/락업 완료",
  proof_uploaded: "증빙 제출",
  confirmed: "상대 확인",
  released: "릴리즈",
  completed: "완료",
  cancelled: "취소",
  disputed: "분쟁",
  expired: "만료",
};

const STATUS_TONE: Partial<Record<OrderStatus, string>> = {
  completed: "bg-success-soft text-success",
  released: "bg-success-soft text-success",
  disputed: "bg-destructive-soft text-destructive",
  created: "bg-primary-soft text-primary",
  paid: "bg-primary-soft text-primary",
  proof_uploaded: "bg-primary-soft text-primary",
  confirmed: "bg-primary-soft text-primary",
  cancelled: "bg-surface-strong text-muted-foreground",
  expired: "bg-surface-strong text-muted-foreground",
};

const ACTIVE: OrderStatus[] = [
  "created",
  "info_shared",
  "paid",
  "proof_uploaded",
  "confirmed",
  "released",
];
const DONE: OrderStatus[] = ["completed"];
const DISPUTE: OrderStatus[] = ["disputed"];
const CANCELLED: OrderStatus[] = ["cancelled", "expired"];

export const Route = createFileRoute("/app/orders")({
  head: () => ({ meta: [{ title: "주문 — EXPEER" }] }),
  component: OrdersList,
});

function OrdersList() {
  const [tab, setTab] = useState<Tab>("active");
  const status =
    tab === "active" ? ACTIVE : tab === "done" ? DONE : tab === "dispute" ? DISPUTE : CANCELLED;
  const { orders, loading } = useOrders({ status });

  return (
    <PhoneShell>
      <header className="px-5 pb-2 pt-6">
        <h1 className="text-[22px] font-extrabold text-foreground">주문</h1>
        <p className="mt-1 text-[12px] font-semibold text-muted-foreground">
          P2P환전과 P2P교환 주문을 상태별로 확인합니다.
        </p>
      </header>
      <div className="px-4 pb-2">
        <div className="grid grid-cols-4 rounded-xl bg-surface p-1">
          {(["active", "done", "dispute", "cancelled"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg py-2 text-[12px] font-bold transition ${tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
            >
              {t === "active"
                ? "진행 중"
                : t === "done"
                  ? "완료"
                  : t === "dispute"
                    ? "분쟁"
                    : "취소"}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger space-y-2.5 px-4 pb-6 pt-2">
        {loading ? (
          <div className="py-12 text-center text-[12px] text-muted-foreground">불러오는 중…</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface py-12 text-center text-[13px] text-muted-foreground">
            해당 상태의 주문이 없습니다.
          </div>
        ) : (
          orders.map((order) => <OrderCard key={order.id} order={order} />)
        )}
      </div>
    </PhoneShell>
  );
}

function tradeKind(order: OrderWithAd) {
  return order.ads?.kind === "crypto_swap" ? "crypto" : "fiat";
}

function orderSummary(order: OrderWithAd) {
  if (tradeKind(order) === "crypto") {
    return {
      title: `${Number(order.amount).toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ${order.asset} → ${Number(order.ads?.to_amount ?? order.fiat_amount).toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ${order.ads?.to_asset ?? order.fiat}`,
      sub: "코인 ↔ 코인 교환",
      badge: "P2P교환",
      tone: "bg-primary-soft text-primary",
    };
  }
  return {
    title: `${Number(order.amount).toLocaleString("ko-KR", { maximumFractionDigits: 4 })} ${order.asset}`,
    sub: `${Number(order.fiat_amount).toLocaleString("ko-KR")} ${order.fiat} · ${order.network}`,
    badge: "P2P환전",
    tone: "bg-success-soft text-success",
  };
}

function OrderCard({ order }: { order: OrderWithAd }) {
  const summary = orderSummary(order);
  return (
    <Link
      to="/app/order/$orderId"
      params={{ orderId: order.id }}
      className="card-lift block rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${summary.tone}`}>
            {summary.badge}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_TONE[order.status] ?? "bg-surface-strong text-foreground"}`}
          >
            {STATUS_LABEL[order.status]}
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground">#{order.id.slice(-4)}</span>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-extrabold text-foreground">{summary.title}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">{summary.sub}</div>
        </div>
        <div className="shrink-0 text-right text-[11px] text-muted-foreground">
          {new Date(order.created_at).toLocaleDateString("ko-KR")}
        </div>
      </div>
    </Link>
  );
}
