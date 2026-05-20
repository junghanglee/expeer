import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "./expeeradmin.dashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { adminToggleSuspend } from "@/utils/admin.functions";
import { fmtNum } from "@/data/format";
import { Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/expeeradmin/merchants")({
  head: () => ({ meta: [{ title: "대량 거래자 — EXPEER" }] }),
  component: Merchants,
});

type TopTrader = {
  id: string;
  nickname: string | null;
  email: string | null;
  trade_count: number;
  rating: number;
  kyc_status: string;
  is_suspended: boolean;
};

function Merchants() {
  const {
    data: traders = [],
    isLoading,
    refetch,
  } = useQuery<TopTrader[]>({
    queryKey: ["admin", "top-traders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nickname, email, trade_count, rating, kyc_status, is_suspended")
        .order("trade_count", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as TopTrader[];
    },
    staleTime: 60_000,
  });

  const toggleSuspend = async (id: string, current: boolean) => {
    const res = await adminToggleSuspend({ data: { userId: id, suspended: !current } });
    if (!res.ok) {
      toast.error(res.error ?? "처리 실패");
      return;
    }
    toast.success(current ? "활성화 완료" : "정지 처리됨");
    refetch();
  };

  return (
    <AdminShell title="대량 거래자 모니터링">
      <div className="mb-4 rounded-2xl border border-border bg-primary-soft p-4 text-[12px] text-foreground">
        <div className="font-bold">📊 거래량 상위 사용자 모니터링</div>
        <div className="mt-1 text-muted-foreground">
          누적 거래 횟수가 많은 사용자를 추적합니다. 의심 행위가 발견되면 계정 정지 조치할 수
          있습니다.
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface text-[11px] font-bold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">순위</th>
                <th className="px-4 py-3">닉네임</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">누적 거래</th>
                <th className="px-4 py-3">평점</th>
                <th className="px-4 py-3">KYC</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {traders.map((t, i) => (
                <tr key={t.id}>
                  <td className="px-4 py-3 num-tnum font-bold text-muted-foreground">#{i + 1}</td>
                  <td className="px-4 py-3 font-bold text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      {i < 3 && <TrendingUp className="h-3 w-3 text-primary" />}
                      {t.nickname ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{t.email ?? "—"}</td>
                  <td className="px-4 py-3 num-tnum">{fmtNum(t.trade_count)}회</td>
                  <td className="px-4 py-3 num-tnum">{Number(t.rating).toFixed(1)}</td>
                  <td className="px-4 py-3 text-[11px] text-muted-foreground">{t.kyc_status}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        t.is_suspended
                          ? "bg-destructive-soft text-destructive"
                          : "bg-success-soft text-success"
                      }`}
                    >
                      {t.is_suspended ? "정지" : "활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleSuspend(t.id, t.is_suspended)}
                      className={`rounded-lg px-3 py-1.5 text-[11px] font-bold ${
                        t.is_suspended
                          ? "bg-success text-success-foreground"
                          : "bg-destructive text-destructive-foreground"
                      }`}
                    >
                      {t.is_suspended ? "활성화" : "정지"}
                    </button>
                  </td>
                </tr>
              ))}
              {traders.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    표시할 거래자가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}
