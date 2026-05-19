import { createFileRoute } from "@tanstack/react-router";

/**
 * [DISABLED — 2026.05] 토스페이먼츠 가상계좌 webhook (DEPOSIT 이벤트)
 *
 * 운영 정책 변경: 자동 PG 입금자명 검증을 비활성화하고,
 * 바이낸스 P2P 방식의 "판매자 수동 확인 (채팅 내)"으로 전환했습니다.
 *
 * 본 파일은 향후 PG 자동검증 재활성화를 대비해 라우트 골격만 보존합니다.
 * 활성화 시:
 *   1. supabase/migrations 또는 app_settings.payment_provider.enabled = true
 *   2. 아래 disabled 분기를 제거하고 git history의 이전 구현 복원
 *
 * 실제 입금 확인 흐름은 src/routes/app.order.$orderId.chat.tsx 의
 * "입금 확인 + 코인 릴리즈" 버튼이 담당합니다.
 */

export const Route = createFileRoute("/api/public/payments/toss")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(
          JSON.stringify({
            ok: false,
            disabled: true,
            message: "Manual seller confirmation mode. PG webhook disabled.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } },
        );
      },
    },
  },
});
