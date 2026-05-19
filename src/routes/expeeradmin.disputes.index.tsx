import { createFileRoute, Link } from "@tanstack/react-router";
import { AdminShell } from "./expeeradmin.dashboard";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/expeeradmin/disputes/")({
  head: () => ({ meta: [{ title: "분쟁 자료센터 — EXPEER" }] }),
  component: Disputes,
});

type Dispute = Tables<"disputes">;

function Disputes() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });
      setItems(data ?? []);
      setLoading(false);
    })();
  }, []);

  return (
    <AdminShell title="분쟁 자료센터">
      <div className="mb-4 rounded-2xl border border-primary bg-primary-soft p-3 text-[12px] text-foreground">
        EXPEER는 P2P 중개 플랫폼으로 직접 중재하지 않습니다. 본 화면은 자료 보존 신청 내역을
        조회·발급하는 용도입니다.
      </div>

      {loading ? (
        <div className="text-muted-foreground">로딩 중...</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background p-6 text-center text-muted-foreground">
          접수된 자료 보존 신청이 없습니다.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((d) => (
            <Link
              key={d.id}
              to="/expeeradmin/disputes/$id"
              params={{ id: d.id }}
              className="card-lift block rounded-2xl border border-border bg-background p-4"
            >
              <div className="flex items-center justify-between">
                <div className="text-[14px] font-bold text-foreground">{d.reason}</div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    d.status === "resolved_buyer" ||
                    d.status === "resolved_seller" ||
                    d.status === "closed"
                      ? "bg-success-soft text-success"
                      : "bg-warning-soft text-warning"
                  }`}
                >
                  {d.status}
                </span>
              </div>
              <div className="mt-1 text-[12px] text-muted-foreground">
                #{d.id.slice(0, 8)} · 주문 {d.order_id.slice(0, 8)} · 신청자{" "}
                {d.opener_id.slice(0, 8)} · {new Date(d.created_at).toLocaleString("ko-KR")}
              </div>
            </Link>
          ))}
        </div>
      )}
    </AdminShell>
  );
}
