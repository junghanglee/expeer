import { createFileRoute, Outlet } from "@tanstack/react-router";
import { RequireAuth } from "@/components/espeer/AuthGuard";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  );
}
