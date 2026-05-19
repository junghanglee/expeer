import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { RequireAuth } from "@/components/espeer/AuthGuard";
import {
  useNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from "@/hooks/useNotifications";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Gavel, Package, Receipt, Send, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "알림 — EXPEER" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  return (
    <RequireAuth>
      <PhoneShell>
        <Inner />
      </PhoneShell>
    </RequireAuth>
  );
}

function Inner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: notifications = [], isLoading } = useNotifications(50);

  const onClickItem = async (n: Notification) => {
    if (!n.read_at) {
      try {
        await markNotificationRead(n.id);
        qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
        qc.invalidateQueries({ queryKey: ["notifications-unread", user?.id] });
      } catch {
        // ignore
      }
    }
    if (n.link) {
      navigate({ to: n.link });
    }
  };

  const onMarkAll = async () => {
    if (!user?.id) return;
    try {
      await markAllNotificationsRead(user.id);
      qc.invalidateQueries({ queryKey: ["notifications", user.id] });
      qc.invalidateQueries({ queryKey: ["notifications-unread", user.id] });
      toast.success("모두 읽음으로 표시했습니다");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "처리 실패";
      toast.error(msg);
    }
  };

  return (
    <div>
      <AppHeader
        title="알림"
        right={
          <button
            onClick={onMarkAll}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:bg-surface"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            모두 읽음
          </button>
        }
      />
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Bell className="mb-2 h-8 w-8 text-muted-foreground" />
          <div className="text-[14px] font-bold text-foreground">알림이 없습니다</div>
          <div className="mt-1 text-[12px] text-muted-foreground">
            새 거래 활동이 있을 때 알려드립니다
          </div>
          <Link
            to="/app/market"
            className="mt-4 rounded-xl bg-primary px-4 py-2 text-[12px] font-bold text-primary-foreground"
          >
            거래소 둘러보기
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {notifications.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => onClickItem(n)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-surface ${
                  !n.read_at ? "bg-primary-soft/40" : ""
                }`}
              >
                <NotifIcon type={n.type} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-bold text-foreground">
                      {n.title}
                    </span>
                    {!n.read_at && (
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  {n.body && (
                    <div className="mt-0.5 line-clamp-2 text-[12px] text-muted-foreground">
                      {n.body}
                    </div>
                  )}
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(n.created_at).toLocaleString("ko-KR")}
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function NotifIcon({ type }: { type: string }) {
  const cfg: Record<string, { Icon: typeof Bell; cls: string }> = {
    order: { Icon: Package, cls: "bg-primary-soft text-primary" },
    payment: { Icon: Receipt, cls: "bg-success-soft text-success" },
    transfer: { Icon: Send, cls: "bg-success-soft text-success" },
    dispute: { Icon: Gavel, cls: "bg-destructive-soft text-destructive" },
    review: { Icon: Star, cls: "bg-warning-soft text-warning-foreground" },
    kyc: { Icon: CheckCheck, cls: "bg-primary-soft text-primary" },
  };
  const { Icon, cls } = cfg[type] ?? { Icon: Bell, cls: "bg-surface text-muted-foreground" };
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cls}`}>
      <Icon className="h-4 w-4" />
    </div>
  );
}
