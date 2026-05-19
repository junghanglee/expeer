import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdminShell } from "./expeeradmin.dashboard";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/expeeradmin/announcements")({
  head: () => ({ meta: [{ title: "공지사항 — EXPEER Admin" }] }),
  component: AdminAnnouncements,
});

function AdminAnnouncements() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  const { data: recent, refetch } = useQuery({
    queryKey: ["admin", "announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,link,created_at,user_id")
        .eq("type", "system")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const send = async () => {
    if (!title.trim()) {
      toast.error("제목을 입력하세요");
      return;
    }
    setSending(true);
    try {
      // 모든 사용자 조회 후 알림 일괄 생성 (RLS 우회 위해서는 admin 권한 필요)
      const { data: users, error: e1 } = await supabase.from("profiles").select("id");
      if (e1) throw e1;
      const rows = (users ?? []).map((u) => ({
        user_id: u.id,
        type: "system" as const,
        title: title.trim(),
        body: body.trim() || null,
        link: link.trim() || null,
      }));
      if (rows.length === 0) {
        toast.error("대상 사용자가 없습니다");
        return;
      }
      // chunk insert (avoid payload limits)
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error } = await supabase.from("notifications").insert(rows.slice(i, i + chunkSize));
        if (error) throw error;
      }
      toast.success(`${rows.length}명에게 공지를 발송했습니다`);
      setTitle("");
      setBody("");
      setLink("");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "발송 실패");
    } finally {
      setSending(false);
    }
  };

  return (
    <AdminShell title="공지사항">
      <div className="grid gap-5 lg:grid-cols-[1fr,1fr]">
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="mb-3 flex items-center gap-2 text-[15px] font-extrabold text-foreground">
            <Megaphone className="h-4 w-4 text-primary" /> 새 공지 발송
          </div>
          <div className="space-y-2.5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="제목"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="내용 (선택)"
              rows={5}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
            />
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="링크 (선택, 예: /app/notifications)"
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-[13px] outline-none focus:border-primary"
            />
            <button
              onClick={send}
              disabled={sending}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              {sending ? "발송 중…" : "전체 사용자에게 발송"}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="mb-3 text-[15px] font-extrabold text-foreground">최근 공지</div>
          {!recent ? (
            <div className="py-10 text-center">
              <Loader2 className="inline h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : recent.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-muted-foreground">
              아직 발송된 공지가 없습니다.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map((n) => (
                <li key={n.id} className="py-3 text-[13px]">
                  <div className="font-bold text-foreground">{n.title}</div>
                  {n.body && (
                    <div className="mt-0.5 text-[12px] text-muted-foreground">{n.body}</div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("ko-KR")}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
