/**
 * Escrow contract 클라이언트 (브라우저 지갑 연동)
 * - viem 기반
 * - 사용자가 직접 MetaMask 등으로 lock/release/refund 트랜잭션 서명
 */
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseUnits,
  encodeFunctionData,
  type Address,
  type Hex,
} from "viem";
import { base, baseSepolia, polygon, mainnet } from "viem/chains";

export type SupportedChain = "base" | "base-sepolia" | "polygon" | "ethereum";

const CHAIN_MAP = {
  base: base,
  "base-sepolia": baseSepolia,
  polygon: polygon,
  ethereum: mainnet,
} as const;

// 배포된 Escrow 컨트랙트 주소
export const ESCROW_ADDRESSES: Record<SupportedChain, Address | null> = {
  "base-sepolia": "0x1986dc4BF85B896eD3211863E906CC2d48147B82",
  base: null,
  polygon: null,
  ethereum: null,
};

// Base Sepolia 테스트용 USDC 토큰 주소 (Circle 공식)
export const TEST_TOKENS: Record<
  SupportedChain,
  { USDC?: { address: Address; decimals: number } }
> = {
  "base-sepolia": {
    USDC: { address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
  },
  base: {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  },
  polygon: {},
  ethereum: {},
};

// 분쟁 해결 arbiter 주소 (참고용)
export const ARBITER_ADDRESS: Address = "0x1986dc4BF85B896eD3211863E906CC2d48147B82";
export const FEE_RECIPIENT_ADDRESS: Address = "0x1986dc4BF85B896eD3211863E906CC2d48147B82";

/**
 * DB의 network 라벨(TRC20/ERC20/Polygon/Base Sepolia 등)을 SupportedChain으로 매핑.
 * 매핑되지 않으면 null 반환 → EscrowPanel은 안내 문구 표시.
 */
export function networkToChain(network: string | null | undefined): SupportedChain | null {
  if (!network) return null;
  const n = network.toLowerCase().replace(/[\s_-]/g, "");
  if (n.includes("sepolia")) return "base-sepolia";
  if (n === "base") return "base";
  if (n === "polygon" || n === "matic") return "polygon";
  if (n === "erc20" || n === "ethereum" || n === "eth") return "ethereum";
  return null;
}

export const ESCROW_ABI = [
  {
    type: "function",
    name: "lock",
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
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "dispute",
    stateMutability: "nonpayable",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getOrder",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "seller", type: "address" },
          { name: "buyer", type: "address" },
          { name: "token", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "expiresAt", type: "uint64" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
] as const;

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export function getPublicClient(chain: SupportedChain) {
  return createPublicClient({ chain: CHAIN_MAP[chain], transport: http() });
}

export function getWalletClient(chain: SupportedChain) {
  if (typeof window === "undefined" || !window.ethereum) {
    throw new Error("지갑이 연결되지 않았습니다. MetaMask 등을 설치해주세요");
  }
  return createWalletClient({
    chain: CHAIN_MAP[chain],
    transport: custom(window.ethereum),
  });
}

/** 주문 ID(uuid string)를 bytes32로 변환 */
export function orderIdToBytes32(orderId: string): Hex {
  // uuid의 - 제거 → 32 bytes로 패딩
  const hex = orderId.replace(/-/g, "").padStart(64, "0");
  return ("0x" + hex.slice(0, 64)) as Hex;
}

export type LockParams = {
  chain: SupportedChain;
  escrowAddress: Address;
  tokenAddress: Address;
  tokenDecimals: number;
  orderId: string;
  buyer: Address;
  amountHuman: number;
  expiresInSec: number;
};

/**
 * 판매자: 토큰 approve → escrow lock
 * 두 번의 트랜잭션 서명 필요
 */
export async function approveAndLock(p: LockParams): Promise<{ approveTx?: Hex; lockTx: Hex }> {
  const wallet = getWalletClient(p.chain);
  const pub = getPublicClient(p.chain);
  const [account] = await wallet.getAddresses();
  const amount = parseUnits(p.amountHuman.toString(), p.tokenDecimals);

  // 1) allowance 체크
  const currentAllowance = (await pub.readContract({
    address: p.tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [account, p.escrowAddress],
  })) as bigint;

  let approveTx: Hex | undefined;
  if (currentAllowance < amount) {
    approveTx = await wallet.writeContract({
      account,
      address: p.tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [p.escrowAddress, amount],
    });
    await pub.waitForTransactionReceipt({ hash: approveTx });
  }

  // 2) lock
  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + p.expiresInSec);
  const lockTx = await wallet.writeContract({
    account,
    address: p.escrowAddress,
    abi: ESCROW_ABI,
    functionName: "lock",
    args: [orderIdToBytes32(p.orderId), p.buyer, p.tokenAddress, amount, expiresAt],
  });
  await pub.waitForTransactionReceipt({ hash: lockTx });

  return { approveTx, lockTx };
}

export async function releaseEscrow(
  chain: SupportedChain,
  escrowAddress: Address,
  orderId: string,
): Promise<Hex> {
  const wallet = getWalletClient(chain);
  const pub = getPublicClient(chain);
  const [account] = await wallet.getAddresses();
  const tx = await wallet.writeContract({
    account,
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "release",
    args: [orderIdToBytes32(orderId)],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
  return tx;
}

export async function refundEscrow(
  chain: SupportedChain,
  escrowAddress: Address,
  orderId: string,
): Promise<Hex> {
  const wallet = getWalletClient(chain);
  const pub = getPublicClient(chain);
  const [account] = await wallet.getAddresses();
  const tx = await wallet.writeContract({
    account,
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "refund",
    args: [orderIdToBytes32(orderId)],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
  return tx;
}

export async function disputeEscrow(
  chain: SupportedChain,
  escrowAddress: Address,
  orderId: string,
): Promise<Hex> {
  const wallet = getWalletClient(chain);
  const pub = getPublicClient(chain);
  const [account] = await wallet.getAddresses();
  const tx = await wallet.writeContract({
    account,
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "dispute",
    args: [orderIdToBytes32(orderId)],
  });
  await pub.waitForTransactionReceipt({ hash: tx });
  return tx;
}

export async function readEscrowOrder(
  chain: SupportedChain,
  escrowAddress: Address,
  orderId: string,
) {
  const pub = getPublicClient(chain);
  return pub.readContract({
    address: escrowAddress,
    abi: ESCROW_ABI,
    functionName: "getOrder",
    args: [orderIdToBytes32(orderId)],
  });
}
