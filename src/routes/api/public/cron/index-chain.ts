import { createFileRoute } from "@tanstack/react-router";
import { runChainIndexer } from "@/utils/chain-indexer.functions";

/**
 * 온체인 이벤트 인덱서 cron
 * pg_cron이 1분마다 호출.
 * 인증: /api/public/* 는 published 사이트에서 auth bypass.
 * 추가 보안 필요 시 Supabase anon key apikey 헤더 검증 가능.
 */
export const Route = createFileRoute("/api/public/cron/index-chain")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await runChainIndexer();
          return new Response(JSON.stringify(result), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "unknown";
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
