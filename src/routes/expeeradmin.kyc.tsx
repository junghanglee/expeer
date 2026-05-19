import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { AdminShell } from "./expeeradmin.dashboard";
import { supabase } from "@/integrations/supabase/client";
import { adminDecideKyc } from "@/utils/admin.functions";
import { Loader2, Check, X, Eye } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/expeeradmin/kyc")({
  head: () => ({ meta: [{ title: "KYC 심사 — EXPEER Admin" }] }),
  component: AdminKyc,
});

function AdminKyc() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>("pending");
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "kyc", status],
    queryFn: async () => {
      let req = supabase
        .from("kyc_submissions")
        .select("id,user_id,full_name,id_type,id_number,status,created_at,id_front_url,selfie_url")
        .order("created_at", { ascending: false })
        .limit(100);
      if (status !== "all") req = req.eq("status", status as never);
      const { data, error } = await req;
      if (error) throw error;
      return data ?? [];
    },
  });

  const decide = async (
    submissionId: string,
    userId: string,
    decision: "approved" | "rejected",
  ) => {
    try {
      const r = await adminDecideKyc({
        data: { submissionId, userId, status: decision, note: note.trim() || null },
      });
      if (!r.ok) throw new Error(r.error);
      toast.success(decision === "approved" ? "승인됨" : "반려됨");
      setOpen(null);
      setNote("");
      qc.invalidateQueries({ queryKey: ["admin", "kyc"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "처리 실패");
    }
  };

  return (
    <AdminShell title="KYC 심사">
      <div className="mb-4 flex items-center gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-semibold ${
              status === s
                ? "bg-foreground text-background"
                : "bg-surface text-foreground hover:bg-surface/70"
            }`}
          >
            {s === "all" ? "전체" : s === "pending" ? "대기" : s === "approved" ? "승인" : "반려"}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {isLoading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (data?.length ?? 0) === 0 ? (
          <div className="py-12 text-center text-[13px] text-muted-foreground">
            제출 내역이 없습니다.
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface text-left text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-semibold">이름</th>
                <th className="px-3 py-2 font-semibold">신분증</th>
                <th className="px-3 py-2 font-semibold">번호</th>
                <th className="px-3 py-2 font-semibold">상태</th>
                <th className="px-3 py-2 font-semibold">제출일</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data ?? []).map((k) => (
                <tr key={k.id}>
                  <td className="px-3 py-2 font-bold">{k.full_name}</td>
                  <td className="px-3 py-2">{k.id_type}</td>
                  <td className="px-3 py-2 font-mono text-[11px]">{k.id_number}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        k.status === "approved"
                          ? "bg-success-soft text-success"
                          : k.status === "rejected"
                            ? "bg-destructive-soft text-destructive"
                            : "bg-warning-soft text-warning-foreground"
                      }`}
                    >
                      {k.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-muted-foreground">
                    {new Date(k.created_at).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => setOpen(open === k.id ? null : k.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold hover:bg-surface"
                    >
                      <Eye className="h-3 w-3" /> 심사
                    </button>
                    {open === k.id && k.status === "pending" && (
                      <div className="mt-2 flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 text-left">
                        <textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="반려 사유 (반려 시 권장)"
                          className="rounded-lg border border-border bg-background p-2 text-[12px]"
                          rows={2}
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => decide(k.id, k.user_id, "approved")}
                            className="flex-1 rounded-lg bg-success px-3 py-1.5 text-[12px] font-bold text-success-foreground"
                          >
                            <Check className="mr-1 inline h-3 w-3" /> 승인
                          </button>
                          <button
                            onClick={() => decide(k.id, k.user_id, "rejected")}
                            className="flex-1 rounded-lg bg-destructive px-3 py-1.5 text-[12px] font-bold text-destructive-foreground"
                          >
                            <X className="mr-1 inline h-3 w-3" /> 반려
                          </button>
                        </div>
                      </div>
                    )}
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
