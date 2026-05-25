import { ChevronLeft } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  showBack?: boolean;
  transparent?: boolean;
}

export function AppHeader({
  title,
  subtitle,
  right,
  showBack = true,
  transparent,
}: AppHeaderProps) {
  const router = useRouter();
  return (
    <header
      className={`sticky top-0 z-20 flex h-14 items-center gap-2 px-3 ${
        transparent ? "bg-transparent" : "border-b border-border bg-background"
      }`}
    >
      {showBack ? (
        <button
          aria-label="뒤로"
          onClick={() => router.history.back()}
          className="flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-surface"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      ) : (
        <div className="w-2" />
      )}
      <div className="min-w-0 flex-1 leading-tight">
        {title && <h1 className="min-w-0 truncate text-[15px] font-bold text-foreground">{title}</h1>}
        {subtitle && <p className="min-w-0 truncate text-[11px] text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-1">{right}</div>
    </header>
  );
}
