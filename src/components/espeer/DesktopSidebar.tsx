import { Link, useLocation } from "@tanstack/react-router";
import { Logo } from "./Logo";
import {
  Home,
  ListOrdered,
  User,
  ArrowLeftRight,
  ArrowRightLeft,
  Activity,
  Settings,
  Bell,
  LogOut,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "@/lib/auth";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  exact?: boolean;
};

// 핵심 두 가지 목적
const primary: NavItem[] = [
  { to: "/app/market", label: "P2P 환전", icon: ArrowLeftRight },
  { to: "/app/swap", label: "P2P 코인 교환", icon: ArrowRightLeft },
];

// 보조 메뉴
const secondary: NavItem[] = [
  { to: "/app", label: "홈", icon: Home, exact: true },
  { to: "/app/orders", label: "주문 내역", icon: ListOrdered },
  { to: "/app/selling", label: "내 활동", icon: Activity },
  { to: "/app/notifications", label: "알림", icon: Bell },
  { to: "/app/profile", label: "프로필 · 지갑", icon: User },
  { to: "/app/settings", label: "설정", icon: Settings },
];

export function DesktopSidebar() {
  const { pathname } = useLocation();
  const { user, signOut } = useAuth();

  const renderItem = (it: NavItem, featured = false) => {
    const active = it.exact
      ? pathname === it.to
      : pathname === it.to || pathname.startsWith(it.to + "/");
    const Icon = it.icon;
    if (featured) {
      return (
        <Link
          key={it.to}
          to={it.to}
          className={`flex items-center gap-3 rounded-xl px-3 py-3 text-[14px] font-bold transition-colors ${
            active
              ? "bg-primary text-primary-foreground"
              : "bg-primary-soft text-primary hover:bg-primary hover:text-primary-foreground"
          }`}
        >
          <Icon className="h-5 w-5" strokeWidth={2.4} />
          <span>{it.label}</span>
        </Link>
      );
    }
    return (
      <Link
        key={it.to}
        to={it.to}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors ${
          active ? "bg-surface text-foreground" : "text-foreground/70 hover:bg-surface"
        }`}
      >
        <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 2} />
        <span>{it.label}</span>
      </Link>
    );
  };

  return (
    <aside className="hidden h-screen w-[260px] shrink-0 flex-col border-r border-border bg-background lg:flex">
      <div className="flex h-16 items-center gap-2 px-5">
        <Link to="/app" className="flex items-center gap-2">
          <Logo height={26} />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <div className="px-3 pb-1.5 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          빠른 거래
        </div>
        <div className="space-y-1.5">{primary.map((it) => renderItem(it, true))}</div>

        <div className="px-3 pb-1 pt-5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          메뉴
        </div>
        <div>{secondary.map((it) => renderItem(it))}</div>
      </div>

      {user && (
        <div className="border-t border-border p-3">
          <div className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2.5">
            <div className="min-w-0">
              <div className="truncate text-[12px] font-bold text-foreground">{user.email}</div>
              <div className="text-[10px] text-muted-foreground">로그인됨</div>
            </div>
            <button
              onClick={() => signOut()}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-background hover:text-destructive"
              title="로그아웃"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
