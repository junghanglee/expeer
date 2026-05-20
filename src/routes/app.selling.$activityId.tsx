import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/selling/$activityId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/order/$orderId",
      params: { orderId: params.activityId },
    });
  },
});
