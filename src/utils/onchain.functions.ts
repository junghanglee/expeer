import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Alchemy 기반 온체인 ERC-20 송금 검증
 * - 지원 네트워크: base, polygon, ethereum
 * - 검증 항목: 송신자, 수신자, 토큰 컨트랙트, 금액, 컨펌 수
 */

type Network = "base" | "polygon" | "ethereum";

const ALCHEMY_RPC: Record<Network, (key: string) => string> = {
  base: (k) => `https://base-mainnet.g.alchemy.com/v2/${k}`,
  polygon: (k) => `https://polygon-mainnet.g.alchemy.com/v2/${k}`,
  ethereum: (k) => `https://eth-mainnet.g.alchemy.com/v2/${k}`,
};

// 토큰 컨트랙트 (소문자)
export const TOKEN_CONTRACTS: Record<
  Network,
  Record<string, { address: string; decimals: number }>
> = {
  base: {
    USDC: { address: "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", decimals: 6 },
    USDT: { address: "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2", decimals: 6 },
  },
  polygon: {
    USDT: { address: "0xc2132d05d31c914a87c6611c10748aeb04b58e8f", decimals: 6 },
    USDC: { address: "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359", decimals: 6 },
  },
  ethereum: {
    USDT: { address: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
    USDC: { address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
  },
};

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

async function rpcCall<T>(network: Network, method: string, params: unknown[]): Promise<T> {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY not configured");
  const url = ALCHEMY_RPC[network](key);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} failed: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result as T;
}

function hexToBigInt(h: string): bigint {
  return BigInt(h);
}

function topicToAddress(topic: string): string {
  return ("0x" + topic.slice(-40)).toLowerCase();
}

export type VerifyResult = {
  ok: boolean;
  status: "confirmed" | "pending" | "failed" | "mismatch";
  confirmations: number;
  detail: {
    from?: string;
    to?: string;
    amount?: string;
    blockNumber?: number;
    expectedTo?: string;
    expectedAmount?: string;
  };
  message: string;
};

export const verifyTransferTx = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      orderId: string;
      txHash: string;
      network: Network;
      asset: string; // "USDT" | "USDC" 등
      expectedTo: string;
      expectedAmount: number; // human readable
    }) => input,
  )
  .handler(async ({ data, context }): Promise<VerifyResult> => {
    const { orderId, txHash, network, asset, expectedTo, expectedAmount } = data;
    const { userId } = context;

    const tokenInfo = TOKEN_CONTRACTS[network]?.[asset];
    if (!tokenInfo) {
      return {
        ok: false,
        status: "failed",
        confirmations: 0,
        detail: {},
        message: `${network}의 ${asset} 토큰을 지원하지 않습니다`,
      };
    }

    try {
      // 1. 트랜잭션 영수증
      const receipt = await rpcCall<{
        status: string;
        from: string;
        to: string;
        blockNumber: string;
        logs: Array<{ address: string; topics: string[]; data: string }>;
      } | null>(network, "eth_getTransactionReceipt", [txHash]);

      if (!receipt) {
        return {
          ok: false,
          status: "pending",
          confirmations: 0,
          detail: {},
          message: "트랜잭션이 아직 블록에 포함되지 않았습니다",
        };
      }
      if (receipt.status !== "0x1") {
        return {
          ok: false,
          status: "failed",
          confirmations: 0,
          detail: {},
          message: "온체인 트랜잭션이 실패했습니다 (revert)",
        };
      }
      if (receipt.to.toLowerCase() !== tokenInfo.address.toLowerCase()) {
        return {
          ok: false,
          status: "mismatch",
          confirmations: 0,
          detail: { to: receipt.to },
          message: `${asset} 컨트랙트 호출이 아닙니다`,
        };
      }

      // 2. Transfer 이벤트 로그 파싱
      const transferLog = receipt.logs.find(
        (l) =>
          l.address.toLowerCase() === tokenInfo.address.toLowerCase() &&
          l.topics[0] === TRANSFER_TOPIC,
      );
      if (!transferLog) {
        return {
          ok: false,
          status: "mismatch",
          confirmations: 0,
          detail: {},
          message: "Transfer 이벤트를 찾을 수 없습니다",
        };
      }
      const fromAddr = topicToAddress(transferLog.topics[1]);
      const toAddr = topicToAddress(transferLog.topics[2]);
      const rawAmount = hexToBigInt(transferLog.data);
      const humanAmount = Number(rawAmount) / 10 ** tokenInfo.decimals;

      // 3. 검증
      const expectedToLc = expectedTo.toLowerCase();
      if (toAddr !== expectedToLc) {
        return {
          ok: false,
          status: "mismatch",
          confirmations: 0,
          detail: {
            from: fromAddr,
            to: toAddr,
            amount: humanAmount.toString(),
            expectedTo: expectedToLc,
          },
          message: `수신 주소가 일치하지 않습니다`,
        };
      }
      // 금액 허용 오차 0.01%
      if (Math.abs(humanAmount - expectedAmount) / expectedAmount > 0.0001) {
        return {
          ok: false,
          status: "mismatch",
          confirmations: 0,
          detail: {
            from: fromAddr,
            to: toAddr,
            amount: humanAmount.toString(),
            expectedAmount: expectedAmount.toString(),
          },
          message: `송금 금액이 일치하지 않습니다 (실제: ${humanAmount}, 예상: ${expectedAmount})`,
        };
      }

      // 4. 컨펌 수
      const latestHex = await rpcCall<string>(network, "eth_blockNumber", []);
      const latest = Number(hexToBigInt(latestHex));
      const txBlock = Number(hexToBigInt(receipt.blockNumber));
      const confirmations = Math.max(0, latest - txBlock + 1);
      const minConfirmations = network === "ethereum" ? 12 : 3;

      const isFinal = confirmations >= minConfirmations;

      // 5. transfers 테이블에 upsert (admin client - 검증된 데이터)
      if (isFinal) {
        await supabaseAdmin.from("transfers").upsert(
          {
            order_id: orderId,
            sender_id: userId,
            asset,
            network,
            amount: humanAmount,
            to_address: toAddr,
            tx_hash: txHash,
            confirmed_at: new Date().toISOString(),
          },
          { onConflict: "tx_hash" },
        );
      }

      return {
        ok: isFinal,
        status: isFinal ? "confirmed" : "pending",
        confirmations,
        detail: {
          from: fromAddr,
          to: toAddr,
          amount: humanAmount.toString(),
          blockNumber: txBlock,
        },
        message: isFinal
          ? `송금이 확인되었습니다 (${confirmations} confirmations)`
          : `컨펌 대기 중 (${confirmations}/${minConfirmations})`,
      };
    } catch (e) {
      console.error("verifyTransferTx error:", e);
      const msg = e instanceof Error ? e.message : "검증 실패";
      return { ok: false, status: "failed", confirmations: 0, detail: {}, message: msg };
    }
  });
