import { useEffect, type ReactNode } from "react";
import { useNavigate, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

export function RequireAuth({
  children,
  requireAdmin = false,
  redirectTo,
}: {
  children: ReactNode;
  requireAdmin?: boolean;
  redirectTo?: string;
}) {
  const { isLoading, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      const target = redirectTo ?? (requireAdmin ? "/expeeradmin" : "/onboarding/login");
      navigate({ to: target, search: { redirect: pathname } as never });
      return;
    }
    if (requireAdmin && !isAdmin) {
      navigate({ to: "/" });
    }
  }, [isLoading, isAuthenticated, isAdmin, requireAdmin, redirectTo, navigate, pathname]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <div className="text-sm text-muted-foreground">로딩 중…</div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  if (requireAdmin && !isAdmin) return null;

  return <>{children}</>;
}
