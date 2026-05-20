import { Link } from "@tanstack/react-router";
import { Bell, ListOrdered, Megaphone, Wallet, ArrowRight, Plus, Inbox } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/hooks/useNotifications";
import { useOrders } from "@/hooks/useOrders";
import { fmtKrw, fmtNum } from "@/data/format";

const STATUS_LABEL: Record<string, string> = {
  created: "생성됨",
  info_shared: "정보공유",
  paid: "입금완료",
  proof_uploaded: "증빙업로드",
  confirmed: "입금확인",
  released: "송금완료",
  completed: "완료",
  cancelled: "취소",
  disputed: "분쟁중",
};

export function DesktopAside() {
  const { user } = useAuth();
  const { data: notifs = [] } = useNotifications(5);
  const { orders } = useOrders({ role: "any" });

  const recentOrders = orders.slice(0, 5);
  const activeOrders = orders.filter(
    (o) => !["completed", "cancelled"].includes(o.status as string),
  ).length;
  const unread = notifs.filter((n) => !n.read_at).length;

  if (!user) {
    return (
      <aside className="hidden h-screen w-[320px] shrink-0 flex-col border-l border-border bg-background xl:flex">
        <div className="flex-1 p-5">
          <div className="rounded-2xl border border-border bg-card p-5 text-center">
            <div className="text-[14px] font-bold text-foreground">로그인 후 사용 가능</div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              로그인하면 진행 중인 주문과 알림을 한눈에 확인할 수 있어요.
            </p>
            <Link
              to="/onboarding/login"
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-[13px] font-bold text-primary-foreground"
            >
              로그인
            </Link>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden h-screen w-[320px] shrink-0 flex-col border-l border-border bg-background xl:flex">
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
        {/* Quick stats */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              진행 주문
            </div>
            <div className="mt-1 num-display text-[22px] text-foreground">{activeOrders}</div>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              새 알림
            </div>
            <div
              className={`mt-1 num-display text-[22px] ${unread > 0 ? "text-primary" : "text-foreground"}`}
            >
              {unread}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="text-[12px] font-bold text-foreground mb-2.5">바로가기</div>
          <div className="grid grid-cols-2 gap-2">
            <QuickAction to="/app/market" icon={ArrowRight} label="P2P 환전" />
            <QuickAction to="/app/selling/new" icon={Plus} label="오퍼 등록" />
            <QuickAction to="/app/ads" icon={Megaphone} label="오퍼 보기" />
            <QuickAction to="/app/wallet" icon={Wallet} label="지갑" />
          </div>
        </div>

        {/* Recent orders */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
              <ListOrdered className="h-3.5 w-3.5" /> 최근 주문
            </div>
            <Link to="/app/orders" className="text-[11px] font-semibold text-primary">
              전체
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <Empty icon={Inbox}>주문 내역이 없습니다</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {recentOrders.map((o) => (
                <li key={o.id}>
                  <Link
                    to="/app/order/$orderId"
                    params={{ orderId: o.id }}
                    className="block px-4 py-2.5 hover:bg-surface"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-[12px] font-bold text-foreground truncate">
                          {o.asset} {fmtNum(Number(o.amount))}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {fmtKrw(Number(o.fiat_amount))}
                        </div>
                      </div>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                        {STATUS_LABEL[o.status as string] ?? o.status}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Notifications */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
              <Bell className="h-3.5 w-3.5" /> 알림
            </div>
            <Link to="/app/notifications" className="text-[11px] font-semibold text-primary">
              전체
            </Link>
          </div>
          {notifs.length === 0 ? (
            <Empty icon={Bell}>새 알림이 없습니다</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {notifs.slice(0, 4).map((n) => (
                <li key={n.id} className="px-4 py-2.5">
                  <div className="flex items-start gap-2">
                    {!n.read_at && (
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    )}
                    <div className="min-w-0">
                      <div className="text-[12px] font-bold text-foreground truncate">
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-[11px] text-muted-foreground truncate">{n.body}</div>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

function QuickAction({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: typeof ArrowRight;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-1.5 rounded-xl bg-surface px-3 py-2.5 text-[12px] font-bold text-foreground hover:bg-primary-soft hover:text-primary"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Link>
  );
}

function Empty({ icon: Icon, children }: { icon: typeof Bell; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
      <Icon className="h-5 w-5" />
      <div className="text-[11px]">{children}</div>
    </div>
  );
}
