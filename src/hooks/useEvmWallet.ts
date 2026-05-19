/**
 * EVM 지갑 연결 훅 (MetaMask / 호환 브라우저 지갑)
 * - viem 기반, window.ethereum 사용
 * - WalletConnect v2 는 별도 추가 가능 (추후)
 */
import { useCallback, useEffect, useState } from "react";
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  formatUnits,
  type Address,
  type Hex,
} from "viem";
import { base, baseSepolia, polygon, mainnet } from "viem/chains";

export type EvmChainKey = "base" | "base-sepolia" | "polygon" | "ethereum";

const CHAINS = {
  base,
  "base-sepolia": baseSepolia,
  polygon,
  ethereum: mainnet,
} as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "decimals",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint8" }],
  },
] as const;

type Eip1193Provider = {
  request: <T = unknown>(args: { method: string; params?: unknown[] }) => Promise<T>;
  on?: (event: string, listener: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

export function getInjectedProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") return null;
  return window.ethereum ?? null;
}

export function isEvmInjected(): boolean {
  return !!getInjectedProvider();
}

export function useEvmWallet() {
  const [address, setAddress] = useState<Address | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const provider = getInjectedProvider();

  const refresh = useCallback(async () => {
    if (!provider) return;
    try {
      const accounts: string[] = await provider.request({ method: "eth_accounts" });
      setAddress((accounts[0] as Address | undefined) ?? null);
      const cid: string = await provider.request({ method: "eth_chainId" });
      setChainId(parseInt(cid, 16));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "지갑 상태를 읽지 못했습니다";
      setError(message);
    }
  }, [provider]);

  useEffect(() => {
    if (!provider) return;
    refresh();
    const onAccounts = (...args: unknown[]) => {
      const accs = Array.isArray(args[0]) ? (args[0] as string[]) : [];
      setAddress((accs[0] as Address | undefined) ?? null);
    };
    const onChain = (...args: unknown[]) => {
      const cid = typeof args[0] === "string" ? args[0] : "0x0";
      setChainId(parseInt(cid, 16));
    };
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider, refresh]);

  const connect = useCallback(async (): Promise<Address | null> => {
    if (!provider) {
      setError("MetaMask 등 EVM 지갑을 먼저 설치해주세요");
      return null;
    }
    setConnecting(true);
    setError(null);
    try {
      const accs: string[] = await provider.request({ method: "eth_requestAccounts" });
      const a = (accs[0] as Address | undefined) ?? null;
      setAddress(a);
      return a;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "지갑 연결이 거부되었습니다";
      setError(message);
      return null;
    } finally {
      setConnecting(false);
    }
  }, [provider]);

  const switchChain = useCallback(
    async (chainKey: EvmChainKey): Promise<boolean> => {
      if (!provider) return false;
      const chain = CHAINS[chainKey];
      const hex = "0x" + chain.id.toString(16);
      try {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: hex }],
        });
        return true;
      } catch (e: unknown) {
        // 4902: unknown chain — try add
        const code =
          typeof e === "object" && e !== null && "code" in e
            ? (e as { code?: unknown }).code
            : null;
        if (code === 4902) {
          try {
            await provider.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: hex,
                  chainName: chain.name,
                  nativeCurrency: chain.nativeCurrency,
                  rpcUrls: chain.rpcUrls.default.http,
                  blockExplorerUrls: chain.blockExplorers
                    ? [chain.blockExplorers.default.url]
                    : undefined,
                },
              ],
            });
            return true;
          } catch (addErr: unknown) {
            const message = addErr instanceof Error ? addErr.message : "체인 추가 실패";
            setError(message);
            return false;
          }
        }
        const message = e instanceof Error ? e.message : "체인 전환 실패";
        setError(message);
        return false;
      }
    },
    [provider],
  );

  return {
    address,
    chainId,
    connecting,
    error,
    connect,
    switchChain,
    refresh,
    hasProvider: !!provider,
  };
}

/**
 * 특정 체인의 ERC20 잔액 조회 (RPC publicClient 사용)
 */
export async function readErc20Balance(params: {
  chainKey: EvmChainKey;
  tokenAddress: Address;
  owner: Address;
}): Promise<{ raw: bigint; formatted: string; decimals: number }> {
  const chain = CHAINS[params.chainKey];
  const pub = createPublicClient({ chain, transport: http() });
  const [raw, decimals] = (await Promise.all([
    pub.readContract({
      address: params.tokenAddress,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [params.owner],
    }),
    pub.readContract({
      address: params.tokenAddress,
      abi: ERC20_ABI,
      functionName: "decimals",
      args: [],
    }),
  ])) as [bigint, number];
  return { raw, formatted: formatUnits(raw, decimals), decimals };
}

/**
 * 광고 등록 전 잔액 사전 검증
 */
export async function verifySellerBalance(params: {
  chainKey: EvmChainKey;
  tokenAddress: Address;
  owner: Address;
  requiredAmount: number;
}): Promise<{ ok: boolean; available: string; required: number }> {
  const { formatted } = await readErc20Balance({
    chainKey: params.chainKey,
    tokenAddress: params.tokenAddress,
    owner: params.owner,
  });
  const available = parseFloat(formatted);
  return {
    ok: available >= params.requiredAmount,
    available: formatted,
    required: params.requiredAmount,
  };
}

/** 짧게 마스킹 */
export function shortAddress(a?: string | null): string {
  if (!a) return "";
  return a.slice(0, 6) + "…" + a.slice(-4);
}
