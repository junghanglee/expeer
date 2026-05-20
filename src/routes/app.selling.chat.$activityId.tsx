import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/app/selling/chat/$activityId")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/app/order/$orderId/chat",
      params: { orderId: params.activityId },
    });
  },
});
