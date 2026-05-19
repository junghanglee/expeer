import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "./expeeradmin.dashboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle, Ban, FileWarning } from "lucide-react";

export const Route = createFileRoute("/expeeradmin/risk")({
  head: () => ({ meta: [{ title: "리스크 경보 — EXPEER" }] }),
  component: Risk,
});

type RiskAlert = {
  id: string;
  level: "high" | "medium";
  category: "dispute" | "cancel" | "suspended";
  user_id: string;
  nickname: string | null;
  email: string | null;
  reason: string;
  count: number;
  ts: string;
};

function useRiskAlerts() {
  return useQuery<RiskAlert[]>({
    queryKey: ["admin", "risk-alerts"],
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

      const [disputes, orders, suspended] = await Promise.all([
        supabase.from("disputes").select("opener_id, created_at").eq("status", "open"),
        supabase
          .from("orders")
          .select("buyer_id, cancelled_at")
          .not("cancelled_at", "is", null)
          .gte("cancelled_at", sevenDaysAgo),
        supabase
          .from("profiles")
          .select("id, nickname, email, updated_at")
          .eq("is_suspended", true),
      ]);

      const alerts: RiskAlert[] = [];

      // 분쟁 다발자
      const disputeCount = new Map<string, { n: number; latest: string }>();
      for (const d of disputes.data ?? []) {
        const cur = disputeCount.get(d.opener_id) ?? { n: 0, latest: d.created_at };
        disputeCount.set(d.opener_id, {
          n: cur.n + 1,
          latest: d.created_at > cur.latest ? d.created_at : cur.latest,
        });
      }

      // 취소 다발자
      const cancelCount = new Map<string, { n: number; latest: string }>();
      for (const o of orders.data ?? []) {
        if (!o.cancelled_at) continue;
        const cur = cancelCount.get(o.buyer_id) ?? { n: 0, latest: o.cancelled_at };
        cancelCount.set(o.buyer_id, {
          n: cur.n + 1,
          latest: o.cancelled_at > cur.latest ? o.cancelled_at : cur.latest,
        });
      }

      // 사용자 프로필 묶기
      const userIds = new Set<string>([...disputeCount.keys(), ...cancelCount.keys()]);
      const profilesMap = new Map<string, { nickname: string | null; email: string | null }>();
      if (userIds.size > 0) {
        const { data } = await supabase
          .from("profiles")
          .select("id, nickname, email")
          .in("id", Array.from(userIds));
        for (const p of data ?? []) {
          profilesMap.set(p.id, { nickname: p.nickname, email: p.email });
        }
      }

      for (const [uid, { n, latest }] of disputeCount) {
        if (n >= 2) {
          const p = profilesMap.get(uid);
          alerts.push({
            id: `dispute-${uid}`,
            level: n >= 3 ? "high" : "medium",
            category: "dispute",
            user_id: uid,
            nickname: p?.nickname ?? null,
            email: p?.email ?? null,
            reason: `미해결 분쟁 ${n}건`,
            count: n,
            ts: latest,
          });
        }
      }

      for (const [uid, { n, latest }] of cancelCount) {
        if (n >= 3) {
          const p = profilesMap.get(uid);
          alerts.push({
            id: `cancel-${uid}`,
            level: n >= 5 ? "high" : "medium",
            category: "cancel",
            user_id: uid,
            nickname: p?.nickname ?? null,
            email: p?.email ?? null,
            reason: `7일 내 주문 취소 ${n}건`,
            count: n,
            ts: latest,
          });
        }
      }

      for (const s of suspended.data ?? []) {
        alerts.push({
          id: `suspended-${s.id}`,
          level: "high",
          category: "suspended",
          user_id: s.id,
          nickname: s.nickname,
          email: s.email,
          reason: "계정 정지 상태",
          count: 1,
          ts: s.updated_at,
        });
      }

      alerts.sort((a, b) => (b.ts > a.ts ? 1 : -1));
      return alerts;
    },
    staleTime: 60_000,
  });
}

function Risk() {
  const { data: alerts = [], isLoading } = useRiskAlerts();

  return (
    <AdminShell title="리스크 경보">
      <div className="mb-4 rounded-2xl border border-border bg-warning-soft p-4 text-[12px]">
        <div className="font-bold text-foreground">⚠️ 자동 탐지 규칙</div>
        <ul className="mt-1 list-disc pl-4 text-muted-foreground">
          <li>미해결 분쟁 2건 이상 보유자</li>
          <li>최근 7일 내 주문 취소 3회 이상</li>
          <li>현재 정지 상태 계정</li>
        </ul>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl border border-border bg-background py-16 text-center text-[13px] text-muted-foreground">
          현재 리스크 경보가 없습니다 ✨
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => {
            const Icon =
              a.category === "suspended"
                ? Ban
                : a.category === "dispute"
                  ? FileWarning
                  : AlertTriangle;
            return (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-background p-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                      a.level === "high"
                        ? "bg-destructive-soft text-destructive"
                        : "bg-warning-soft text-warning-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-bold text-foreground">{a.reason}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {a.nickname ?? "—"} · {a.email ?? a.user_id.slice(0, 8)} ·{" "}
                      {new Date(a.ts).toLocaleString("ko-KR")}
                    </div>
                  </div>
                </div>
                <span
                  className={`ml-2 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    a.level === "high"
                      ? "bg-destructive-soft text-destructive"
                      : "bg-warning-soft text-warning-foreground"
                  }`}
                >
                  {a.level === "high" ? "높음" : "보통"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </AdminShell>
  );
}
