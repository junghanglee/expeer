import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "./expeeradmin.dashboard";
import { supabase } from "@/integrations/supabase/client";
import { fmtKrw, fmtNum } from "@/data/mock";
import { Loader2, Search, Filter } from "lucide-react";

export const Route = createFileRoute("/expeeradmin/orders")({
  head: () => ({ meta: [{ title: "주문 관리 — EXPEER Admin" }] }),
  component: AdminOrders,
});

const STATUS_OPTIONS = [
  "all",
  "created",
  "info_shared",
  "paid",
  "proof_uploaded",
  "confirmed",
  "released",
  "completed",
  "cancelled",
  "disputed",
] as const;

function AdminOrders() {
  const [status, setStatus] = useState<string>("all");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "orders", status],
    queryFn: async () => {
      let req = supabase
        .from("orders")
        .select(
          "id,asset,amount,fiat,fiat_amount,price,status,buyer_id,seller_id,created_at,escrow_status",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (status !== "all") req = req.eq("status", status as never);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (data ?? []).filter(
    (o) =>
      !q.trim() ||
      o.id.includes(q.trim()) ||
      (o.buyer_id ?? "").includes(q.trim()) ||
      (o.seller_id ?? "").includes(q.trim()),
  );

  return (
    <AdminShell title="주문 관리">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="주문ID / 사용자ID 검색"
            className="w-60 bg-transparent text-[13px] outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-transparent text-[13px] outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s === "all" ? "전체 상태" : s}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto text-[12px] text-muted-foreground">
          총 <b className="text-foreground">{rows.length}</b>건
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted-foreground">
            주문이 없습니다.
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">주문ID</th>
                <th className="px-3 py-2 font-semibold">자산</th>
                <th className="px-3 py-2 text-right font-semibold">수량</th>
                <th className="px-3 py-2 text-right font-semibold">금액</th>
                <th className="px-3 py-2 font-semibold">상태</th>
                <th className="px-3 py-2 font-semibold">에스크로</th>
                <th className="px-3 py-2 font-semibold">생성</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((o) => (
                <tr key={o.id} className="hover:bg-surface/60">
                  <td className="px-3 py-2 font-mono text-[11px] text-foreground">
                    {o.id.slice(0, 10)}
                  </td>
                  <td className="px-3 py-2 font-bold">{o.asset}</td>
                  <td className="px-3 py-2 text-right num-display">{fmtNum(Number(o.amount))}</td>
                  <td className="px-3 py-2 text-right num-display">
                    {o.fiat === "KRW"
                      ? fmtKrw(Number(o.fiat_amount))
                      : `${fmtNum(Number(o.fiat_amount))} ${o.fiat}`}
                  </td>
                  <td className="px-3 py-2">
                    <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-semibold">
                      {o.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{o.escrow_status}</td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {new Date(o.created_at).toLocaleString("ko-KR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
