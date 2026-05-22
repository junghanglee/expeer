import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "./expeeradmin.dashboard";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Loader2, ShieldCheck, ShieldX, Eye, X, Plus, Trash2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/expeeradmin/users")({
  head: () => ({ meta: [{ title: "사용자 관리 — EXPEER" }] }),
  component: Users,
});

type Profile = Tables<"profiles">;
type KycSubmission = Tables<"kyc_submissions">;
type PhoneBlacklistEntry = Tables<"phone_blacklist_entries">;

function Users() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [reviewKyc, setReviewKyc] = useState<KycSubmission | null>(null);
  const [blacklist, setBlacklist] = useState<PhoneBlacklistEntry[]>([]);
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [source, setSource] = useState("manual");
  const [blacklistBusy, setBlacklistBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [profilesRes, blacklistRes] = await Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase
        .from("phone_blacklist_entries")
        .select("*")
        .order("created_at", { ascending: false }),
    ]);
    setProfiles(profilesRes.data ?? []);
    setBlacklist((blacklistRes.data ?? []) as PhoneBlacklistEntry[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = filter === "all" ? profiles : profiles.filter((p) => p.kyc_status === filter);
  const normalizedPhone = phone.replace(/\D/g, "");
  const blacklistCount = blacklist.filter((row) => row.is_active).length;

  const addBlacklist = async () => {
    if (!normalizedPhone) return toast.error("휴대폰 번호를 입력해 주세요");
    setBlacklistBusy(true);
    try {
      const { error } = await supabase.rpc("add_phone_blacklist_entry", {
        _phone: normalizedPhone,
        _reason: reason.trim() || null,
        _source: source.trim() || "manual",
      });
      if (error) throw error;
      toast.success("블랙리스트에 등록했습니다");
      setPhone("");
      setReason("");
      setSource("manual");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setBlacklistBusy(false);
    }
  };

  const toggleBlacklist = async (id: string, active: boolean) => {
    setBlacklistBusy(true);
    try {
      const { error } = await supabase
        .from("phone_blacklist_entries")
        .update({ is_active: !active })
        .eq("id", id);
      if (error) throw error;
      toast.success(active ? "블랙리스트 해제 완료" : "블랙리스트 재활성화 완료");
      await load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBlacklistBusy(false);
    }
  };

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
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_1.1fr]">
        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-bold text-foreground">휴대폰 블랙리스트</div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                현재 활성 {blacklistCount}건 · 거래 차단용 DB 직접 등록
              </div>
            </div>
            <div className="rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-bold text-warning-foreground">
              관리자 전용
            </div>
          </div>

          <div className="mt-3 grid gap-2">
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="휴대폰 번호"
              className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="등록 사유"
              className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="출처 예: manual / haja2"
              className="rounded-xl border border-border bg-surface px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <button
              onClick={addBlacklist}
              disabled={blacklistBusy}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> 등록
            </button>
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground">
            입력하면 바로 활성 등록됩니다. 번호는 정규화해서 저장합니다.
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[12px] font-bold text-foreground">최근 블랙리스트</div>
              <div className="mt-1 text-[11px] text-muted-foreground">활성/비활성 전환 가능</div>
            </div>
            <AlertTriangle className="h-4 w-4 text-warning-foreground" />
          </div>
          <div className="mt-3 max-h-52 space-y-2 overflow-auto pr-1">
            {blacklist.length === 0 ? (
              <div className="rounded-xl bg-surface px-3 py-4 text-center text-[12px] text-muted-foreground">
                등록된 블랙리스트가 없습니다
              </div>
            ) : (
              blacklist.slice(0, 6).map((row) => (
                <div
                  key={row.id}
                  className="flex items-start justify-between rounded-xl border border-border px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-foreground">
                      {row.phone_last4 ? `****${row.phone_last4}` : row.phone_hash.slice(0, 8)}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {row.reason ?? "사유 없음"} · {row.source ?? "manual"}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleBlacklist(row.id, row.is_active)}
                    disabled={blacklistBusy}
                    className={`inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold ${
                      row.is_active
                        ? "bg-destructive-soft text-destructive"
                        : "bg-success-soft text-success"
                    }`}
                  >
                    <Trash2 className="h-3 w-3" /> {row.is_active ? "해제" : "재활성"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
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
                <th className="px-4 py-3">휴대폰</th>
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
                  <td className="px-4 py-3 text-muted-foreground">{u.phone ?? "—"}</td>
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
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
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
