import { Link, useLocation } from "@tanstack/react-router";
import { ArrowLeftRight, ListOrdered, Repeat2, Settings, Wallet } from "lucide-react";
import type { ComponentType } from "react";

interface Tab {
  to: "/app/market" | "/app/swap" | "/app/orders" | "/app/profile" | "/app/settings";
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  activeWhen: (pathname: string) => boolean;
}

const isPath = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`);

const tabs: Tab[] = [
  {
    to: "/app/market",
    label: "P2P환전",
    icon: ArrowLeftRight,
    activeWhen: (pathname) =>
      isPath(pathname, "/app/market") ||
      isPath(pathname, "/app/ads") ||
      isPath(pathname, "/app/order/new") ||
      isPath(pathname, "/app/selling"),
  },
  {
    to: "/app/swap",
    label: "P2P교환",
    icon: Repeat2,
    activeWhen: (pathname) => isPath(pathname, "/app/swap"),
  },
  {
    to: "/app/orders",
    label: "주문",
    icon: ListOrdered,
    activeWhen: (pathname) =>
      isPath(pathname, "/app/orders") ||
      (isPath(pathname, "/app/order") && !isPath(pathname, "/app/order/new")),
  },
  {
    to: "/app/profile",
    label: "지갑·계좌",
    icon: Wallet,
    activeWhen: (pathname) => isPath(pathname, "/app/profile"),
  },
  {
    to: "/app/settings",
    label: "설정",
    icon: Settings,
    activeWhen: (pathname) => isPath(pathname, "/app/settings"),
  },
];

export function BottomTabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="sticky bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <ul className="mx-auto grid max-w-[480px] grid-cols-5">
        {tabs.map((t) => {
          const active = t.activeWhen(pathname);
          const Icon = t.icon;
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={`flex min-w-0 flex-col items-center justify-center gap-0.5 px-0.5 py-2 text-[9.5px] font-bold leading-tight transition-colors min-[360px]:text-[10px] ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={active ? 2.4 : 2} />
                <span className="max-w-full whitespace-nowrap tracking-[-0.04em]">{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
