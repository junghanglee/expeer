import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "./expeeradmin.dashboard";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldX, Eye, X } from "lucide-react";

export const Route = createFileRoute("/expeeradmin/users")({
  head: () => ({ meta: [{ title: "사용자 관리 — EXPEER" }] }),
  component: Users,
});

type Profile = Tables<"profiles">;
type KycSubmission = Tables<"kyc_submissions">;

function Users() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [reviewKyc, setReviewKyc] = useState<KycSubmission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    setProfiles(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter === "all" ? profiles : profiles.filter((p) => p.kyc_status === filter);

  const openKyc = async (userId: string) => {
    const { data } = await supabase
      .from("kyc_submissions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!data) {
      toast.error("KYC 제출 내역이 없습니다");
      return;
    }
    setReviewKyc(data);
  };

  return (
    <AdminShell title="사용자 관리">
      <div className="mb-4 flex gap-2">
        {(["all", "pending", "approved", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-surface text-foreground"
            }`}
          >
            {f === "all"
              ? "전체"
              : f === "pending"
                ? "심사 대기"
                : f === "approved"
                  ? "승인"
                  : "반려"}
            <span className="ml-1.5 num-tnum opacity-70">
              {f === "all" ? profiles.length : profiles.filter((p) => p.kyc_status === f).length}
            </span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-background">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="bg-surface text-[11px] font-bold uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">닉네임</th>
                <th className="px-4 py-3">이메일</th>
                <th className="px-4 py-3">KYC</th>
                <th className="px-4 py-3">레벨</th>
                <th className="px-4 py-3">거래</th>
                <th className="px-4 py-3">평점</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">조치</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3 font-bold text-foreground">{u.nickname ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                  <td className="px-4 py-3">
                    <KycBadge status={u.kyc_status} />
                  </td>
                  <td className="px-4 py-3 num-tnum">Lv.{u.kyc_level}</td>
                  <td className="px-4 py-3 num-tnum">{u.trade_count}</td>
                  <td className="px-4 py-3 num-tnum">{Number(u.rating).toFixed(1)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                        u.is_suspended
                          ? "bg-destructive-soft text-destructive"
                          : "bg-success-soft text-success"
                      }`}
                    >
                      {u.is_suspended ? "정지" : "활성"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openKyc(u.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-[11px] font-bold text-foreground"
                    >
                      <Eye className="h-3 w-3" /> KYC 검토
                    </button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    표시할 사용자가 없습니다
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {reviewKyc && (
        <KycReviewModal
          submission={reviewKyc}
          onClose={() => setReviewKyc(null)}
          onResolved={async () => {
            setReviewKyc(null);
            await load();
          }}
        />
      )}
    </AdminShell>
  );
}

function KycBadge({ status }: { status: Profile["kyc_status"] }) {
  const map: Record<string, string> = {
    none: "bg-surface text-muted-foreground",
    pending: "bg-warning-soft text-warning-foreground",
    approved: "bg-success-soft text-success",
    rejected: "bg-destructive-soft text-destructive",
  };
  const label: Record<string, string> = {
    none: "미제출",
    pending: "심사중",
    approved: "승인",
    rejected: "반려",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function KycReviewModal({
  submission,
  onClose,
  onResolved,
}: {
  submission: KycSubmission;
  onClose: () => void;
  onResolved: () => void;
}) {
  const [note, setNote] = useState(submission.reviewer_note ?? "");
  const [busy, setBusy] = useState(false);
  const [urls, setUrls] = useState<{ front?: string; back?: string; selfie?: string }>({});

  useEffect(() => {
    const sign = async () => {
      const get = async (path: string | null) => {
        if (!path) return undefined;
        const { data } = await supabase.storage.from("kyc-documents").createSignedUrl(path, 600);
        return data?.signedUrl;
      };
      setUrls({
        front: await get(submission.id_front_url),
        back: await get(submission.id_back_url),
        selfie: await get(submission.selfie_url),
      });
    };
    sign();
  }, [submission]);

  const decide = async (status: "approved" | "rejected") => {
    setBusy(true);
    try {
      const { adminDecideKyc } = await import("@/utils/admin.functions");
      const res = await adminDecideKyc({
        data: {
          submissionId: submission.id,
          userId: submission.user_id,
          status,
          note: note.trim() || null,
        },
      });
      if (!res.ok) throw new Error(res.error ?? "처리 실패");

      toast.success(status === "approved" ? "승인 처리됨" : "반려 처리됨");
      onResolved();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "처리 실패";
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-background p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[18px] font-extrabold text-foreground">KYC 검토</h2>
          <button onClick={onClose} className="text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <Info label="실명" value={submission.full_name} />
          <Info label="신분증 종류" value={submission.id_type} />
          <Info label="신분증 번호" value={submission.id_number} />
          <Info label="현재 상태" value={submission.status} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <DocImage label="신분증 앞" url={urls.front} />
          <DocImage label="신분증 뒤" url={urls.back} />
          <DocImage label="셀피" url={urls.selfie} />
        </div>

        <div className="mt-4">
          <div className="mb-1 text-[11px] font-semibold text-muted-foreground">검토 메모</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="반려 사유 또는 메모"
            className="w-full rounded-xl bg-surface px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => decide("rejected")}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-destructive py-3 text-[13px] font-bold text-destructive-foreground disabled:opacity-50"
          >
            <ShieldX className="h-4 w-4" /> 반려
          </button>
          <button
            onClick={() => decide("approved")}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
          >
            <ShieldCheck className="h-4 w-4" /> 승인
          </button>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="rounded-lg bg-surface p-2.5">
      <div className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-bold text-foreground">{value ?? "—"}</div>
    </div>
  );
}

function DocImage({ label, url }: { label: string; url?: string }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold text-muted-foreground">{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          <img src={url} alt={label} className="aspect-square w-full rounded-lg object-cover" />
        </a>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-surface text-[11px] text-muted-foreground">
          없음
        </div>
      )}
    </div>
  );
}
