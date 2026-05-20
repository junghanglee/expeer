import { createFileRoute, Link, useLocation, useNavigate } from "@tanstack/react-router";
import { fmtKrw, fmtNum } from "@/data/format";
import { useAuth } from "@/lib/auth";
import { useAdminKpi, useRecentDisputes, useRecentOrders } from "@/hooks/useAdminStats";
import {
  LayoutDashboard,
  Users,
  ShieldAlert,
  Gavel,
  Store,
  ArrowRight,
  LogOut,
  Loader2,
  Settings,
  ClipboardList,
  Megaphone,
  IdCard,
} from "lucide-react";
import type { ReactNode } from "react";

// Admin shell layout
function AdminShell({ children, title }: { children: ReactNode; title: string }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { isLoading, isAuthenticated, isAdmin, signOut, user } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-sm text-muted-foreground">로딩 중…</div>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    if (typeof window !== "undefined") {
      setTimeout(() => navigate({ to: "/expeeradmin" }), 0);
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-sm text-muted-foreground">
          접근 권한이 없습니다. 로그인 페이지로 이동합니다…
        </div>
      </div>
    );
  }

  type Item = {
    to:
      | "/expeeradmin/dashboard"
      | "/expeeradmin/users"
      | "/expeeradmin/disputes"
      | "/expeeradmin/risk"
      | "/expeeradmin/merchants"
      | "/expeeradmin/settings"
      | "/expeeradmin/orders"
      | "/expeeradmin/ads"
      | "/expeeradmin/kyc"
      | "/expeeradmin/announcements";
    label: string;
    icon: typeof LayoutDashboard;
    exact?: boolean;
    group?: string;
  };
  const items: Item[] = [
    {
      to: "/expeeradmin/dashboard",
      label: "대시보드",
      icon: LayoutDashboard,
      exact: true,
      group: "운영 현황",
    },
    { to: "/expeeradmin/orders", label: "주문 관리", icon: ClipboardList, group: "거래" },
    { to: "/expeeradmin/ads", label: "광고/오퍼", icon: Megaphone, group: "거래" },
    { to: "/expeeradmin/disputes", label: "분쟁센터", icon: Gavel, group: "거래" },
    { to: "/expeeradmin/users", label: "사용자", icon: Users, group: "회원" },
    { to: "/expeeradmin/kyc", label: "KYC 심사", icon: IdCard, group: "회원" },
    { to: "/expeeradmin/merchants", label: "머천트 심사", icon: Store, group: "회원" },
    { to: "/expeeradmin/risk", label: "리스크 경보", icon: ShieldAlert, group: "보안" },
    { to: "/expeeradmin/announcements", label: "공지사항", icon: Megaphone, group: "콘텐츠" },
    { to: "/expeeradmin/settings", label: "플랫폼 설정", icon: Settings, group: "시스템" },
  ];

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto flex min-h-screen max-w-[1280px]">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-background md:block">
          <div className="px-5 py-5">
            <div className="text-[18px] font-extrabold text-foreground">EXPEER</div>
            <div className="text-[11px] font-bold text-destructive">ADMIN</div>
          </div>
          <nav className="space-y-3 px-3 pb-6">
            {Array.from(new Set(items.map((i) => i.group ?? "기타"))).map((group) => (
              <div key={group} className="space-y-0.5">
                <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {group}
                </div>
                {items
                  .filter((i) => (i.group ?? "기타") === group)
                  .map((it) => {
                    const active = it.exact ? pathname === it.to : pathname.startsWith(it.to);
                    const Icon = it.icon;
                    return (
                      <Link
                        key={it.to}
                        to={it.to}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-semibold ${
                          active
                            ? "bg-primary-soft text-primary"
                            : "text-foreground hover:bg-surface"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {it.label}
                      </Link>
                    );
                  })}
              </div>
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-x-hidden">
          <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background px-5">
            <h1 className="text-[15px] font-bold text-foreground">{title}</h1>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-muted-foreground">{user?.email}</span>
              <button
                onClick={async () => {
                  await signOut();
                  navigate({ to: "/expeeradmin" });
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-surface"
              >
                <LogOut className="h-3 w-3" /> 로그아웃
              </button>
            </div>
          </header>
          <div className="p-5 anim-fade-up">{children}</div>
        </main>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/expeeradmin/dashboard")({
  head: () => ({ meta: [{ title: "운영자 대시보드 — EXPEER" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: kpi, isLoading: kpiLoading } = useAdminKpi();
  const { data: disputes = [], isLoading: dLoading } = useRecentDisputes(5);
  const { data: orders = [], isLoading: oLoading } = useRecentOrders(5);

  return (
    <AdminShell title="대시보드">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="오늘 거래" value={kpiLoading ? "—" : `${fmtNum(kpi?.todayOrders ?? 0)}건`} />
        <Kpi
          label="오늘 거래액 (KRW)"
          value={kpiLoading ? "—" : fmtKrw(kpi?.todayVolumeKrw ?? 0)}
          primary
        />
        <Kpi
          label="진행 중 분쟁"
          value={kpiLoading ? "—" : `${kpi?.openDisputes ?? 0}건`}
          tone="danger"
        />
        <Kpi
          label="KYC 심사 대기"
          value={kpiLoading ? "—" : `${kpi?.pendingKyc ?? 0}건`}
          tone="warn"
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi
          label="정지된 사용자"
          value={kpiLoading ? "—" : `${kpi?.suspendedUsers ?? 0}명`}
          tone="danger"
        />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <Card title="최근 분쟁" link="/expeeradmin/disputes">
          {dLoading ? (
            <Spinner />
          ) : disputes.length === 0 ? (
            <Empty>분쟁 내역 없음</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {disputes.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-3 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-foreground">{d.reason}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      주문 {d.order_id.slice(0, 8)} ·{" "}
                      {new Date(d.created_at).toLocaleString("ko-KR")}
                    </div>
                  </div>
                  <span
                    className={`ml-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                      d.status === "resolved_buyer" ||
                      d.status === "resolved_seller" ||
                      d.status === "closed"
                        ? "bg-success-soft text-success"
                        : d.status === "reviewing"
                          ? "bg-primary-soft text-primary"
                          : "bg-destructive-soft text-destructive"
                    }`}
                  >
                    {d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="최근 주문" link="/expeeradmin/disputes">
          {oLoading ? (
            <Spinner />
          ) : orders.length === 0 ? (
            <Empty>주문 내역 없음</Empty>
          ) : (
            <ul className="divide-y divide-border">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between py-3 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-bold text-foreground">
                      {o.asset} · {fmtNum(Number(o.amount))} {o.asset}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {fmtKrw(Number(o.fiat_amount))} ·{" "}
                      {new Date(o.created_at).toLocaleString("ko-KR")}
                    </div>
                  </div>
                  <span className="ml-2 rounded-full bg-surface px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    {o.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-[12px] text-muted-foreground">{children}</div>;
}

function Kpi({
  label,
  value,
  tone,
  primary,
}: {
  label: string;
  value: string;
  tone?: "danger" | "warn";
  primary?: boolean;
}) {
  const c =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-warning-foreground"
        : primary
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-1 num-display text-[22px] ${c}`}>{value}</div>
    </div>
  );
}

function Card({
  title,
  link,
  children,
}: {
  title: string;
  link:
    | "/expeeradmin/disputes"
    | "/expeeradmin/risk"
    | "/expeeradmin/users"
    | "/expeeradmin/merchants";
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-[14px] font-bold text-foreground">{title}</h2>
        <Link
          to={link}
          className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-primary"
        >
          전체보기 <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}

// Re-export shell for use in sibling admin route files
export { AdminShell };
