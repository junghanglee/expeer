import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * 온체인 이벤트 인덱서
 * - ExpeerEscrowVaultV2의 Locked/Released/Refunded/Disputed 이벤트를 폴링
 * - DB orders.escrow_status / status 자동 동기화
 * - 진실의 원천(source of truth)은 컨트랙트, DB는 인덱스/캐시
 */

type Network = "base" | "polygon" | "base-sepolia";

const RPC: Record<Network, (k: string) => string> = {
  base: (k) => `https://base-mainnet.g.alchemy.com/v2/${k}`,
  polygon: (k) => `https://polygon-mainnet.g.alchemy.com/v2/${k}`,
  "base-sepolia": (k) => `https://base-sepolia.g.alchemy.com/v2/${k}`,
};

// keccak256 event signatures (V2 contract)
const TOPICS = {
  Locked: "0x5546fe5fdc362afe39d0d8d8acaa3b21e6172bbf6ad4dfdf9f3f1c4d4a6f9c20", // computed below if mismatch — we'll use ethers/viem keccak
  Released: "0x0000000000000000000000000000000000000000000000000000000000000000",
  Refunded: "0x0000000000000000000000000000000000000000000000000000000000000000",
  Disputed: "0x0000000000000000000000000000000000000000000000000000000000000000",
};

// 정확한 토픽은 viem keccak256으로 계산
import { keccak256, toHex } from "viem";

const SIGS = {
  Locked: "Locked(bytes32,address,address,address,uint256,uint64)",
  Released: "Released(bytes32,address,uint256,uint256)",
  Refunded: "Refunded(bytes32,address,uint256)",
  Disputed: "Disputed(bytes32,address)",
};

const TOPIC_MAP = {
  Locked: keccak256(toHex(SIGS.Locked)),
  Released: keccak256(toHex(SIGS.Released)),
  Refunded: keccak256(toHex(SIGS.Refunded)),
  Disputed: keccak256(toHex(SIGS.Disputed)),
};

const MAX_BLOCK_RANGE = 2000; // Alchemy free tier 안전 범위

async function rpc<T>(net: Network, method: string, params: unknown[]): Promise<T> {
  const key = process.env.ALCHEMY_API_KEY;
  if (!key) throw new Error("ALCHEMY_API_KEY missing");
  const r = await fetch(RPC[net](key), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!r.ok) throw new Error(`RPC ${method} ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(j.error.message);
  return j.result;
}

type LogEntry = {
  address: string;
  topics: string[];
  data: string;
  blockNumber: string;
  transactionHash: string;
};

async function processNetwork(net: Network, contract: string, fromBlock: number) {
  const latestHex = await rpc<string>(net, "eth_blockNumber", []);
  const latest = parseInt(latestHex, 16);
  const toBlock = Math.min(latest, fromBlock + MAX_BLOCK_RANGE);
  if (toBlock <= fromBlock) return { processed: 0, lastBlock: fromBlock };

  const logs = await rpc<LogEntry[]>(net, "eth_getLogs", [
    {
      address: contract,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16),
      topics: [[TOPIC_MAP.Locked, TOPIC_MAP.Released, TOPIC_MAP.Refunded, TOPIC_MAP.Disputed]],
    },
  ]);

  let processed = 0;
  for (const log of logs) {
    const sig = log.topics[0];
    const orderIdHash = log.topics[1]; // bytes32 indexed
    if (!orderIdHash) continue;

    // orderIdHash = keccak256(orderUuid) — DB에서 매칭
    // 우리 컨트랙트는 클라이언트가 keccak256(uuid)를 orderId로 넣음
    const { data: orderRow } = await supabaseAdmin
      .from("orders")
      .select("id, status, escrow_status")
      .eq("escrow_order_id_hash", orderIdHash.toLowerCase())
      .maybeSingle();

    if (!orderRow) continue;

    const updates: Record<string, unknown> = {};
    if (sig === TOPIC_MAP.Locked && orderRow.escrow_status !== "locked") {
      updates.escrow_status = "locked";
      updates.escrow_lock_tx_hash = log.transactionHash;
    } else if (sig === TOPIC_MAP.Released && orderRow.escrow_status !== "released") {
      updates.escrow_status = "released";
      updates.escrow_release_tx_hash = log.transactionHash;
      if (orderRow.status !== "completed") {
        updates.status = "completed";
        updates.released_at = new Date().toISOString();
        updates.completed_at = new Date().toISOString();
      }
    } else if (sig === TOPIC_MAP.Refunded && orderRow.escrow_status !== "refunded") {
      updates.escrow_status = "refunded";
      if (orderRow.status !== "cancelled") {
        updates.status = "cancelled";
        updates.cancelled_at = new Date().toISOString();
        updates.cancel_reason = "온체인 환불 (만료/분쟁 해결)";
      }
    } else if (sig === TOPIC_MAP.Disputed && orderRow.escrow_status !== "disputed") {
      updates.escrow_status = "disputed";
      updates.status = "disputed";
    }

    if (Object.keys(updates).length > 0) {
      await supabaseAdmin
        .from("orders")
        .update(updates as never)
        .eq("id", orderRow.id);
      processed++;
    }
  }

  return { processed, lastBlock: toBlock };
}

export const runChainIndexer = createServerFn({ method: "POST" }).handler(async () => {
  const { data: contractsRow } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "escrow_contracts")
    .maybeSingle();
  const { data: stateRow } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "indexer_state")
    .maybeSingle();

  const contracts = (contractsRow?.value as Record<string, string | null>) ?? {};
  const state = (stateRow?.value as Record<string, { last_block: number }>) ?? {};

  const results: Record<string, object | string> = {};
  const newState: Record<string, { last_block: number }> = { ...state };

  for (const [net, addr] of Object.entries(contracts)) {
    if (!addr) {
      results[net] = "no contract";
      continue;
    }
    const fromBlock = state[net]?.last_block ?? 0;
    if (fromBlock === 0) {
      // 첫 실행: 최신 블록부터 시작 (히스토리 인덱싱 X)
      const latest = parseInt(await rpc<string>(net as Network, "eth_blockNumber", []), 16);
      newState[net] = { last_block: latest };
      results[net] = { initialized: latest };
      continue;
    }
    try {
      const r = await processNetwork(net as Network, addr, fromBlock);
      newState[net] = { last_block: r.lastBlock };
      results[net] = r;
    } catch (e: unknown) {
      results[net] = { error: e instanceof Error ? e.message : "unknown" };
    }
  }

  await supabaseAdmin.from("app_settings").update({ value: newState }).eq("key", "indexer_state");
  return { ok: true, results };
});
