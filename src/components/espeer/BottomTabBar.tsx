import { Link, useLocation } from "@tanstack/react-router";
import { Home, ArrowLeftRight, ArrowRightLeft, Activity, User } from "lucide-react";

interface Tab {
  to: "/app" | "/app/market" | "/app/swap" | "/app/selling" | "/app/profile";
  label: string;
  icon: typeof Home;
  exact?: boolean;
}

const tabs: Tab[] = [
  { to: "/app", label: "홈", icon: Home, exact: true },
  { to: "/app/market", label: "P2P환전", icon: ArrowLeftRight },
  { to: "/app/swap", label: "P2P교환", icon: ArrowRightLeft },
  { to: "/app/selling", label: "활동", icon: Activity },
  { to: "/app/profile", label: "프로필", icon: User },
];

export function BottomTabBar() {
  const { pathname } = useLocation();
  return (
    <nav className="sticky bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <ul className="mx-auto grid max-w-[480px] grid-cols-5">
        {tabs.map((t) => {
          const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
          const Icon = t.icon;
          return (
            <li key={t.to}>
              <Link
                to={t.to}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium transition-colors ${
                  active ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
                <span>{t.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
