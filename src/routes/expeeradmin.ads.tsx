import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "./expeeradmin.dashboard";
import { supabase } from "@/integrations/supabase/client";
import { fmtNum } from "@/data/format";
import { Loader2, Filter, Search, Pause, Play } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/expeeradmin/ads")({
  head: () => ({ meta: [{ title: "광고/오퍼 관리 — EXPEER Admin" }] }),
  component: AdminAds,
});

function AdminAds() {
  const qc = useQueryClient();
  const [side, setSide] = useState<"all" | "buy" | "sell">("all");
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "ads", side],
    queryFn: async () => {
      let req = supabase
        .from("ads")
        .select(
          "id,user_id,side,asset,network,fiat,price,total_amount,available_amount,status,created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (side !== "all") req = req.eq("side", side);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = (data ?? []).filter(
    (a) =>
      !q.trim() ||
      a.id.includes(q.trim()) ||
      (a.user_id ?? "").includes(q.trim()) ||
      a.asset.toLowerCase().includes(q.trim().toLowerCase()),
  );

  const toggle = async (id: string, current: string) => {
    const next = current === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("ads")
      .update({ status: next as never })
      .eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(`광고 ${next === "active" ? "활성화" : "일시정지"}`);
      qc.invalidateQueries({ queryKey: ["admin", "ads"] });
    }
  };

  return (
    <AdminShell title="광고/오퍼 관리">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="광고ID / 사용자ID / 자산 검색"
            className="w-72 bg-transparent text-[13px] outline-none"
          />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={side}
            onChange={(e) => setSide(e.target.value as never)}
            className="bg-transparent text-[13px] outline-none"
          >
            <option value="all">전체 매수/매도</option>
            <option value="buy">매수만</option>
            <option value="sell">매도만</option>
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
            광고가 없습니다.
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">광고ID</th>
                <th className="px-3 py-2 font-semibold">유형</th>
                <th className="px-3 py-2 font-semibold">자산</th>
                <th className="px-3 py-2 text-right font-semibold">단가</th>
                <th className="px-3 py-2 text-right font-semibold">잔여/총량</th>
                <th className="px-3 py-2 font-semibold">상태</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className="px-3 py-2 font-mono text-[11px]">{a.id.slice(0, 10)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        a.side === "buy"
                          ? "bg-success-soft text-success"
                          : "bg-destructive-soft text-destructive"
                      }`}
                    >
                      {a.side === "buy" ? "매수" : "매도"}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-bold">
                    {a.asset}/{a.fiat}
                  </td>
                  <td className="px-3 py-2 text-right num-display">{fmtNum(Number(a.price))}</td>
                  <td className="px-3 py-2 text-right num-display">
                    {fmtNum(Number(a.available_amount))} / {fmtNum(Number(a.total_amount))}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        a.status === "active"
                          ? "bg-success-soft text-success"
                          : "bg-surface text-muted-foreground"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => toggle(a.id, a.status)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-surface"
                    >
                      {a.status === "active" ? (
                        <Pause className="h-3 w-3" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      {a.status === "active" ? "정지" : "활성화"}
                    </button>
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
