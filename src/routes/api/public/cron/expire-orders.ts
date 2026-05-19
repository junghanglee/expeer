import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * 만료된 주문 자동 정리 — pg_cron 또는 외부 스케줄러에서 호출.
 *
 * URL: GET /api/public/cron/expire-orders?key=<CRON_SECRET>
 *
 * - 미입금 상태(`created`, `info_shared`)이고 expires_at 경과 → cancelled + 사유 기록
 * - 에스크로 락업된 채로 만료된 주문은 별도 처리 (분쟁 큐로 이관)
 *
 * 보안: CRON_SECRET 환경변수와 정확히 일치하는 key 쿼리 파라미터 필요.
 */

function ok(message: string, extra?: Record<string, unknown>) {
  return new Response(
    JSON.stringify({ ok: true, message, ...extra, at: new Date().toISOString() }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

export const Route = createFileRoute("/api/public/cron/expire-orders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const key = url.searchParams.get("key");
        const expected = process.env.CRON_SECRET;
        if (!expected || !key || key !== expected) return unauthorized();

        const nowIso = new Date().toISOString();

        // 1) 미입금 상태로 만료된 주문 → cancelled
        const { data: expiredUnpaid, error: e1 } = await supabaseAdmin
          .from("orders")
          .update({
            status: "cancelled",
            cancelled_at: nowIso,
            cancel_reason: "결제 시간 초과로 자동 취소",
          })
          .lt("expires_at", nowIso)
          .in("status", ["created", "info_shared"])
          .select("id");
        if (e1) return new Response(`Error: ${e1.message}`, { status: 500 });

        // 2) 에스크로 락업 주문이 만료된 경우 → 'disputed' 로 전환 + 운영자 알림
        const { data: expiredLocked, error: e2 } = await supabaseAdmin
          .from("orders")
          .update({
            status: "disputed",
            cancel_reason: "에스크로 만료 — 운영자 검토 필요",
          })
          .lt("expires_at", nowIso)
          .eq("escrow_status", "locked")
          .not("status", "in", "(completed,cancelled,disputed)")
          .select("id");
        if (e2) return new Response(`Error: ${e2.message}`, { status: 500 });

        return ok("expire-orders done", {
          cancelled: expiredUnpaid?.length ?? 0,
          escalated: expiredLocked?.length ?? 0,
        });
      },
    },
  },
});
