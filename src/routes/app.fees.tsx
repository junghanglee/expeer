import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/lib/auth";
import { ChevronLeft, Receipt } from "lucide-react";

export const Route = createFileRoute("/app/fees")({
  head: () => ({ meta: [{ title: "수수료 내역 — EXPEER" }] }),
  component: FeesPage,
});

type RoleFilter = "all" | "buyer" | "seller";

function FeesPage() {
  const { user } = useAuth();
  const [role, setRole] = useState<RoleFilter>("all");
  // 수수료가 발생/확정되는 거래는 완료된 주문 기준
  const { orders, loading } = useOrders({ status: "completed" });

  const rows = useMemo(() => {
    if (!user) return [];
    return orders
      .map((o) => {
        const isBuyer = o.buyer_id === user.id;
        const isSeller = o.seller_id === user.id;
        const myFeePct = isBuyer ? Number(o.buyer_fee_pct) : Number(o.seller_fee_pct);
        const myFeeAmount = isBuyer ? Number(o.buyer_fee_amount) : Number(o.seller_fee_amount);
        const myRole: "buyer" | "seller" | null = isBuyer ? "buyer" : isSeller ? "seller" : null;
        const time = o.completed_at ?? o.released_at ?? o.created_at;
        return { o, myRole, myFeePct, myFeeAmount, time };
      })
      .filter((r) => r.myRole !== null)
      .filter((r) => (role === "all" ? true : r.myRole === role))
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  }, [orders, user, role]);

  const totalFee = rows.reduce((s, r) => s + r.myFeeAmount, 0);
  const totalVolume = rows.reduce((s, r) => s + Number(r.o.fiat_amount), 0);

  return (
    <PhoneShell>
      <header className="flex items-center gap-2 px-4 pb-2 pt-6">
        <Link
          to="/app/profile"
          className="-ml-2 inline-flex h-9 w-9 items-center justify-center rounded-full text-foreground hover:bg-surface"
          aria-label="뒤로"
        >
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-[20px] font-extrabold text-foreground">수수료 내역</h1>
      </header>

      <section className="px-4 pb-2">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[11px] font-semibold text-muted-foreground">누적 수수료</div>
              <div className="num-display mt-1 text-2xl text-foreground">
                {Math.round(totalFee).toLocaleString("ko-KR")}{" "}
                <span className="text-[13px] font-semibold text-muted-foreground">KRW</span>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[11px] font-semibold text-muted-foreground">누적 거래액</div>
              <div className="num-display mt-1 text-[15px] text-foreground">
                {Math.round(totalVolume).toLocaleString("ko-KR")}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="px-4 pb-2 pt-2">
        <div className="flex rounded-xl bg-surface p-1">
          {(["all", "buyer", "seller"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setRole(t)}
              className={`flex-1 rounded-lg py-2 text-[13px] font-bold transition ${
                role === t ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t === "all" ? "전체" : t === "buyer" ? "구매자" : "판매자"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 px-4 pb-8 pt-2">
        {loading ? (
          <div className="py-12 text-center text-[12px] text-muted-foreground">불러오는 중…</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-surface py-12 text-center text-[13px] text-muted-foreground">
            <Receipt className="mx-auto mb-2 h-6 w-6 opacity-50" />
            정산된 수수료가 없어요
          </div>
        ) : (
          rows.map(({ o, myRole, myFeePct, myFeeAmount, time }) => (
            <Link
              key={o.id}
              to="/app/order/$orderId"
              params={{ orderId: o.id }}
              className="card-lift block rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    myRole === "buyer"
                      ? "bg-primary-soft text-primary"
                      : "bg-success-soft text-success"
                  }`}
                >
                  {myRole === "buyer" ? "구매" : "판매"} · {myFeePct}%
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(time).toLocaleString("ko-KR", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <div className="num-display text-[15px] text-foreground">
                    {Number(o.amount).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}{" "}
                    {o.asset}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    거래액 {Number(o.fiat_amount).toLocaleString("ko-KR")} {o.fiat}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-muted-foreground">수수료</div>
                  <div className="num-display text-lg text-destructive">
                    -{Math.round(myFeeAmount).toLocaleString("ko-KR")}
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
