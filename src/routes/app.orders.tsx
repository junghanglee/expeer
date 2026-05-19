import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { useOrders } from "@/hooks/useOrders";
import { useState } from "react";
import type { Enums } from "@/integrations/supabase/types";

type OrderStatus = Enums<"order_status">;

const STATUS_LABEL: Record<OrderStatus, string> = {
  created: "결제 대기",
  info_shared: "정보 공유",
  paid: "송금 완료",
  proof_uploaded: "증빙 제출",
  confirmed: "판매자 확인",
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

export const Route = createFileRoute("/app/orders")({
  head: () => ({ meta: [{ title: "내 주문 — EXPEER" }] }),
  component: OrdersList,
});

function OrdersList() {
  const [tab, setTab] = useState<"active" | "done" | "dispute">("active");
  const status = tab === "active" ? ACTIVE : tab === "done" ? DONE : DISPUTE;
  const { orders, loading } = useOrders({ status });

  return (
    <PhoneShell>
      <header className="px-5 pb-2 pt-6">
        <h1 className="text-[22px] font-extrabold text-foreground">내 주문</h1>
      </header>
      <div className="px-4 pb-2">
        <div className="flex rounded-xl bg-surface p-1">
          {(["active", "done", "dispute"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition ${
                tab === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "active" ? "진행중" : t === "done" ? "완료" : "분쟁"}
            </button>
          ))}
        </div>
      </div>

      <div className="stagger space-y-2.5 px-4 pb-6 pt-2">
        {loading ? (
          <div className="py-12 text-center text-[12px] text-muted-foreground">불러오는 중…</div>
        ) : orders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface py-12 text-center text-[13px] text-muted-foreground">
            주문이 없어요
          </div>
        ) : (
          orders.map((o) => (
            <Link
              key={o.id}
              to="/app/order/$orderId"
              params={{ orderId: o.id }}
              className="card-lift block rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    STATUS_TONE[o.status] ?? "bg-surface-strong text-foreground"
                  }`}
                >
                  {STATUS_LABEL[o.status]}
                </span>
                <span className="text-[11px] text-muted-foreground">#{o.id.slice(-4)}</span>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="num-display text-lg text-foreground">
                    {Number(o.amount).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}{" "}
                    {o.asset}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{o.network}</div>
                </div>
                <div className="text-right">
                  <div className="num-display text-[15px] text-foreground">
                    {Number(o.fiat_amount).toLocaleString("ko-KR")} {o.fiat}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(o.created_at).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </PhoneShell>
  );
}
