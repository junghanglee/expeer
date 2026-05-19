import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/wallet")({
  beforeLoad: () => {
    throw redirect({ to: "/app/profile" });
  },
});
