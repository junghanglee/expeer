import { useCallback, useState } from "react";
import {
  createWalletClient,
  custom,
  keccak256,
  toHex,
  parseUnits,
  encodeFunctionData,
  type Hash,
} from "viem";
import { base, baseSepolia, polygon } from "viem/chains";
import { useEvmWallet, getInjectedProvider } from "./useEvmWallet";
import { supabase } from "@/integrations/supabase/client";

/**
 * ExpeerEscrowVaultV2 직접 호출 hook (사용자 지갑으로)
 * - lock(): 판매자가 토큰을 컨트랙트에 락업
 * - release(): 판매자가 구매자에게 송금 트리거
 * - refund(): 판매자/arbiter가 환불
 * - dispute(): 양 당사자가 분쟁 신청
 *
 * orderId(uuid) → keccak256으로 bytes32 변환 후 컨트랙트 호출.
 * 인덱서가 이벤트를 감지해 DB를 자동 업데이트.
 */

const VAULT_ABI = [
  {
    name: "lock",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orderId", type: "bytes32" },
      { name: "buyer", type: "address" },
      { name: "token", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "expiresAt", type: "uint64" },
    ],
    outputs: [],
  },
  {
    name: "release",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "refund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
  {
    name: "dispute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
] as const;

const ERC20_APPROVE_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;

const CHAIN_MAP = { base, "base-sepolia": baseSepolia, polygon } as const;
type ChainKey = keyof typeof CHAIN_MAP;

export function orderIdToBytes32(orderUuid: string): `0x${string}` {
  return keccak256(toHex(orderUuid));
}

export function useEscrowVault() {
  const { address, switchChain } = useEvmWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getVaultAddress = useCallback(async (chain: ChainKey): Promise<`0x${string}` | null> => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "escrow_contracts")
      .maybeSingle();
    const contracts = (data?.value as Record<string, string | null>) ?? {};
    const addr = contracts[chain];
    return addr && addr.startsWith("0x") ? (addr as `0x${string}`) : null;
  }, []);

  const writeContract = useCallback(
    async (chain: ChainKey, to: `0x${string}`, data: `0x${string}`): Promise<Hash> => {
      if (!address) throw new Error("지갑이 연결되지 않았습니다");
      const provider = getInjectedProvider();
      if (!provider) throw new Error("MetaMask가 설치되지 않았습니다");
      await switchChain(chain);
      const client = createWalletClient({
        account: address as `0x${string}`,
        chain: CHAIN_MAP[chain],
        transport: custom(provider),
      });
      return client.sendTransaction({ to, data, account: address as `0x${string}` });
    },
    [address, switchChain],
  );

  const approveAndLock = useCallback(
    async (params: {
      chain: ChainKey;
      orderUuid: string;
      buyer: `0x${string}`;
      tokenAddress: `0x${string}`;
      tokenDecimals: number;
      amount: number;
      expiresAt: Date;
    }) => {
      setBusy(true);
      setError(null);
      try {
        const vault = await getVaultAddress(params.chain);
        if (!vault) throw new Error(`${params.chain}에 에스크로 컨트랙트가 등록되지 않았습니다`);
        const amountWei = parseUnits(params.amount.toString(), params.tokenDecimals);

        // 1. approve
        const approveData = encodeFunctionData({
          abi: ERC20_APPROVE_ABI,
          functionName: "approve",
          args: [vault, amountWei],
        });
        const approveTx = await writeContract(params.chain, params.tokenAddress, approveData);

        // 2. lock
        const orderIdHash = orderIdToBytes32(params.orderUuid);
        const lockData = encodeFunctionData({
          abi: VAULT_ABI,
          functionName: "lock",
          args: [
            orderIdHash,
            params.buyer,
            params.tokenAddress,
            amountWei,
            BigInt(Math.floor(params.expiresAt.getTime() / 1000)),
          ],
        });
        const lockTx = await writeContract(params.chain, vault, lockData);

        // DB에 hash 저장 (인덱서가 매칭에 사용)
        await supabase
          .from("orders")
          .update({
            escrow_order_id_hash: orderIdHash.toLowerCase(),
            escrow_contract_address: vault,
            chain: params.chain,
          } as never)
          .eq("id", params.orderUuid);

        return { approveTx, lockTx, orderIdHash };
      } catch (e: unknown) {
        const m = e instanceof Error ? e.message : "락업 실패";
        setError(m);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [getVaultAddress, writeContract],
  );

  const callMethod = useCallback(
    async (method: "release" | "refund" | "dispute", chain: ChainKey, orderUuid: string) => {
      setBusy(true);
      setError(null);
      try {
        const vault = await getVaultAddress(chain);
        if (!vault) throw new Error(`${chain}에 에스크로 컨트랙트가 등록되지 않았습니다`);
        const orderIdHash = orderIdToBytes32(orderUuid);
        const data = encodeFunctionData({
          abi: VAULT_ABI,
          functionName: method,
          args: [orderIdHash],
        });
        return await writeContract(chain, vault, data);
      } catch (e: unknown) {
        const m = e instanceof Error ? e.message : `${method} 실패`;
        setError(m);
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [getVaultAddress, writeContract],
  );

  return {
    busy,
    error,
    address,
    approveAndLock,
    release: (chain: ChainKey, orderUuid: string) => callMethod("release", chain, orderUuid),
    refund: (chain: ChainKey, orderUuid: string) => callMethod("refund", chain, orderUuid),
    dispute: (chain: ChainKey, orderUuid: string) => callMethod("dispute", chain, orderUuid),
  };
}
