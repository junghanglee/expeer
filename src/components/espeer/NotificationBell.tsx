import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useUnreadCount } from "@/hooks/useNotifications";

export function NotificationBell() {
  const { data: count = 0 } = useUnreadCount();

  return (
    <Link
      to="/app/notifications"
      aria-label="알림"
      className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground hover:bg-surface"
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute right-1.5 top-1.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
