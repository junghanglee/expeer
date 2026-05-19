// EXPEER mock data — used across all UX prototype routes
export type Asset = "USDT" | "USDC";
export type Chain = "Polygon" | "BSC" | "Ethereum";
export type Bank = "토스뱅크" | "KB국민" | "신한" | "카카오뱅크" | "우리" | "농협";
export type AdSide = "buy" | "sell"; // 광고 입장: sell = 판매자가 코인을 팔겠다 (사용자는 사는 입장)

export type VerificationLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type RiskTier = "Safe" | "Standard" | "Restricted" | "Review" | "Suspended";

export interface MerchantSeller {
  id: string;
  name: string;
  isMerchant: boolean;
  level: VerificationLevel;
  trades30d: number;
  completionRate: number; // 0~100
  avgReleaseSec: number;
  disputeRate: number; // 0~100
  rating: number; // 0~5
  online: boolean;
}

export interface Ad {
  id: string;
  side: AdSide;
  asset: Asset;
  chain: Chain;
  unitPrice: number; // KRW per 1 token
  available: number; // tokens
  minKrw: number;
  maxKrw: number;
  banks: Bank[];
  responseSec: number;
  seller: MerchantSeller;
  notice?: string;
  requiresLevel: VerificationLevel;
  blockNewbie: boolean;
}

export type OrderStatus =
  | "ESCROW_PENDING"
  | "ESCROW_FUNDED"
  | "PAYMENT_PENDING"
  | "PAYMENT_MARKED"
  | "SELLER_REVIEWING"
  | "RELEASED"
  | "CANCELLED"
  | "EXPIRED"
  | "DISPUTED"
  | "REFUNDED";

export interface Order {
  id: string;
  adId: string;
  asset: Asset;
  chain: Chain;
  amountToken: number;
  amountKrw: number;
  unitPrice: number;
  status: OrderStatus;
  createdAt: string;
  expiresAt: string;
  buyerName: string;
  sellerName: string;
  buyerAccount: { bank: Bank; number: string; holder: string };
  sellerAccount: { bank: Bank; number: string; holder: string };
  buyerWallet: string;
  txHash?: string;
  riskScore: number; // 0~100, lower = safer
  riskTier: RiskTier;
  riskSignals: { label: string; ok: boolean }[];
}

export interface ChatMessage {
  id: string;
  from: "buyer" | "seller" | "system";
  text: string;
  ts: string;
}

export interface Dispute {
  id: string;
  orderId: string;
  reason: string;
  openedBy: "buyer" | "seller";
  openedAt: string;
  status: "OPEN" | "REVIEWING" | "RESOLVED";
  resolution?: "BUYER_WIN" | "SELLER_WIN" | "PARTIAL";
}

export const MOCK_ME = {
  id: "u_me",
  name: "김토스",
  level: 3 as VerificationLevel,
  monthlyVolumeKrw: 4_350_000,
  trades: 12,
  completionRate: 100,
  avgReleaseSec: 92,
};

const sellers: MerchantSeller[] = [
  {
    id: "m_1",
    name: "EXPEER 머천트 #001",
    isMerchant: true,
    level: 5,
    trades30d: 1284,
    completionRate: 99.8,
    avgReleaseSec: 45,
    disputeRate: 0.1,
    rating: 4.9,
    online: true,
  },
  {
    id: "m_2",
    name: "스테이블허브",
    isMerchant: true,
    level: 5,
    trades30d: 942,
    completionRate: 99.5,
    avgReleaseSec: 62,
    disputeRate: 0.3,
    rating: 4.8,
    online: true,
  },
  {
    id: "m_3",
    name: "코인브릿지",
    isMerchant: true,
    level: 4,
    trades30d: 488,
    completionRate: 98.7,
    avgReleaseSec: 110,
    disputeRate: 0.6,
    rating: 4.7,
    online: true,
  },
  {
    id: "u_42",
    name: "박상훈",
    isMerchant: false,
    level: 3,
    trades30d: 21,
    completionRate: 95.2,
    avgReleaseSec: 240,
    disputeRate: 1.2,
    rating: 4.5,
    online: false,
  },
  {
    id: "u_77",
    name: "이수민",
    isMerchant: false,
    level: 3,
    trades30d: 14,
    completionRate: 92.0,
    avgReleaseSec: 320,
    disputeRate: 2.1,
    rating: 4.3,
    online: true,
  },
];

export const MOCK_ADS: Ad[] = [
  {
    id: "ad_001",
    side: "sell",
    asset: "USDT",
    chain: "Polygon",
    unitPrice: 1387,
    available: 25_000,
    minKrw: 100_000,
    maxKrw: 10_000_000,
    banks: ["토스뱅크", "KB국민", "신한"],
    responseSec: 45,
    seller: sellers[0],
    notice: "사전 등록된 본인 명의 계좌만 송금 가능합니다.",
    requiresLevel: 3,
    blockNewbie: true,
  },
  {
    id: "ad_002",
    side: "sell",
    asset: "USDT",
    chain: "BSC",
    unitPrice: 1386,
    available: 18_500,
    minKrw: 50_000,
    maxKrw: 5_000_000,
    banks: ["토스뱅크", "카카오뱅크"],
    responseSec: 62,
    seller: sellers[1],
    requiresLevel: 3,
    blockNewbie: true,
  },
  {
    id: "ad_003",
    side: "sell",
    asset: "USDC",
    chain: "Polygon",
    unitPrice: 1389,
    available: 8_200,
    minKrw: 100_000,
    maxKrw: 3_000_000,
    banks: ["KB국민", "신한", "우리"],
    responseSec: 110,
    seller: sellers[2],
    requiresLevel: 3,
    blockNewbie: false,
  },
  {
    id: "ad_004",
    side: "sell",
    asset: "USDT",
    chain: "Polygon",
    unitPrice: 1390,
    available: 1_200,
    minKrw: 50_000,
    maxKrw: 1_000_000,
    banks: ["토스뱅크"],
    responseSec: 240,
    seller: sellers[3],
    requiresLevel: 3,
    blockNewbie: false,
  },
  {
    id: "ad_005",
    side: "buy",
    asset: "USDT",
    chain: "Polygon",
    unitPrice: 1383,
    available: 12_000,
    minKrw: 100_000,
    maxKrw: 5_000_000,
    banks: ["토스뱅크", "KB국민"],
    responseSec: 80,
    seller: sellers[1],
    requiresLevel: 3,
    blockNewbie: true,
  },
  {
    id: "ad_006",
    side: "buy",
    asset: "USDC",
    chain: "BSC",
    unitPrice: 1384,
    available: 6_500,
    minKrw: 50_000,
    maxKrw: 2_000_000,
    banks: ["신한", "카카오뱅크"],
    responseSec: 150,
    seller: sellers[4],
    requiresLevel: 3,
    blockNewbie: false,
  },
];

export const MOCK_ORDERS: Order[] = [
  {
    id: "ord_4821",
    adId: "ad_001",
    asset: "USDT",
    chain: "Polygon",
    amountToken: 720,
    amountKrw: 998_640,
    unitPrice: 1387,
    status: "PAYMENT_PENDING",
    createdAt: "2026-04-26T14:30:00Z",
    expiresAt: "2026-04-26T14:45:00Z",
    buyerName: "김토스",
    sellerName: "EXPEER 머천트 #001",
    buyerAccount: { bank: "토스뱅크", number: "1000-1234-5678", holder: "김토스" },
    sellerAccount: { bank: "KB국민", number: "987-6543-21098", holder: "EXPEER01" },
    buyerWallet: "0x71C7…F3aA",
    txHash: "0xabc123…lock",
    riskScore: 12,
    riskTier: "Safe",
    riskSignals: [
      { label: "사전 등록 계좌에서 송금", ok: true },
      { label: "예금주명 일치", ok: true },
      { label: "신규 계정 아님", ok: true },
      { label: "동일 기기 다계정 없음", ok: true },
    ],
  },
  {
    id: "ord_4815",
    adId: "ad_002",
    asset: "USDT",
    chain: "BSC",
    amountToken: 360,
    amountKrw: 498_960,
    unitPrice: 1386,
    status: "RELEASED",
    createdAt: "2026-04-25T09:12:00Z",
    expiresAt: "2026-04-25T09:27:00Z",
    buyerName: "김토스",
    sellerName: "스테이블허브",
    buyerAccount: { bank: "토스뱅크", number: "1000-1234-5678", holder: "김토스" },
    sellerAccount: { bank: "카카오뱅크", number: "3333-22-1111111", holder: "스테이블허브" },
    buyerWallet: "0x71C7…F3aA",
    txHash: "0xdef456…release",
    riskScore: 8,
    riskTier: "Safe",
    riskSignals: [
      { label: "사전 등록 계좌에서 송금", ok: true },
      { label: "예금주명 일치", ok: true },
    ],
  },
  {
    id: "ord_4799",
    adId: "ad_004",
    asset: "USDT",
    chain: "Polygon",
    amountToken: 1500,
    amountKrw: 2_085_000,
    unitPrice: 1390,
    status: "DISPUTED",
    createdAt: "2026-04-24T19:00:00Z",
    expiresAt: "2026-04-24T19:15:00Z",
    buyerName: "신규사용자",
    sellerName: "박상훈",
    buyerAccount: { bank: "신한", number: "110-555-99999", holder: "타인" },
    sellerAccount: { bank: "토스뱅크", number: "1000-9999-1234", holder: "박상훈" },
    buyerWallet: "0x99A2…B11C",
    riskScore: 78,
    riskTier: "Review",
    riskSignals: [
      { label: "사전 등록 계좌에서 송금", ok: false },
      { label: "예금주명 일치", ok: false },
      { label: "신규 계정 고액 거래", ok: false },
      { label: "동일 IP 다계정 의심", ok: false },
    ],
  },
];

export const MOCK_CHAT: Record<string, ChatMessage[]> = {
  ord_4821: [
    { id: "c1", from: "system", text: "주문이 생성되었습니다.", ts: "14:30" },
    { id: "c2", from: "system", text: "에스크로 락업이 완료되었습니다. (720 USDT)", ts: "14:30" },
    { id: "c3", from: "seller", text: "안녕하세요, 입금 후 알려주세요.", ts: "14:31" },
    { id: "c4", from: "buyer", text: "네, 송금 진행하겠습니다.", ts: "14:32" },
  ],
  ord_4799: [
    { id: "c1", from: "system", text: "주문이 생성되었습니다.", ts: "19:00" },
    { id: "c2", from: "system", text: "에스크로 락업 완료.", ts: "19:00" },
    { id: "c3", from: "buyer", text: "송금 완료했습니다 확인 부탁드려요", ts: "19:08" },
    { id: "c4", from: "seller", text: "예금주명이 다른데 본인 계좌가 맞나요?", ts: "19:09" },
    {
      id: "c5",
      from: "system",
      text: "분쟁이 접수되었습니다. 운영자가 검토 중입니다.",
      ts: "19:11",
    },
  ],
};

export const MOCK_BANK_ACCOUNTS = [
  {
    id: "ba_1",
    bank: "토스뱅크" as Bank,
    number: "1000-1234-5678",
    holder: "김토스",
    verified: true,
    primary: true,
  },
  {
    id: "ba_2",
    bank: "KB국민" as Bank,
    number: "987-65-432109",
    holder: "김토스",
    verified: true,
    primary: false,
  },
];

export const MOCK_WALLETS = [
  {
    id: "w_1",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
    chain: "Polygon" as Chain,
    balance: { USDT: 1240.5, USDC: 320.0 },
    verified: true,
  },
];

// 체인/코인별 화이트리스트 주소록
export interface SavedWalletAddress {
  id: string;
  asset: "USDT" | "USDC" | "DAI" | "BTC" | "ETH" | "SOL" | "MATIC" | "BNB" | "XRP";
  label: string;
  address: string;
}
export const MOCK_SAVED_ADDRESSES: SavedWalletAddress[] = [
  {
    id: "sa_1",
    asset: "USDT",
    label: "메인 EVM 지갑",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  },
  {
    id: "sa_2",
    asset: "USDC",
    label: "메인 EVM 지갑",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  },
  {
    id: "sa_3",
    asset: "BTC",
    label: "콜드월렛",
    address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq",
  },
  {
    id: "sa_4",
    asset: "ETH",
    label: "MetaMask",
    address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F",
  },
];

// 신분 확인 상태
export const MOCK_IDENTITY = {
  idUploaded: true,
  idHolderName: "김토스",
  selfieMatched: true,
  smsVerified: true,
};

export const MOCK_ADMIN_KPI = {
  todayOrders: 1284,
  todayVolumeKrw: 1_820_000_000,
  openDisputes: 7,
  riskAlerts: 23,
  pendingMerchants: 4,
};

export const MOCK_DISPUTES: Dispute[] = [
  {
    id: "dp_001",
    orderId: "ord_4799",
    reason: "예금주명 불일치 / 제3자 송금 의심",
    openedBy: "seller",
    openedAt: "2026-04-24T19:11:00Z",
    status: "REVIEWING",
  },
  {
    id: "dp_002",
    orderId: "ord_4612",
    reason: "송금했으나 판매자 미확인",
    openedBy: "buyer",
    openedAt: "2026-04-23T11:02:00Z",
    status: "OPEN",
  },
  {
    id: "dp_003",
    orderId: "ord_4588",
    reason: "허위 입금완료 표시",
    openedBy: "seller",
    openedAt: "2026-04-22T08:40:00Z",
    status: "RESOLVED",
    resolution: "SELLER_WIN",
  },
];

export const MOCK_RISK_ALERTS = [
  {
    id: "ra_1",
    userId: "u_213",
    reason: "동일 계좌 3개 계정 사용",
    level: "high" as const,
    ts: "10분 전",
  },
  {
    id: "ra_2",
    userId: "u_318",
    reason: "고위험 IP / VPN 탐지",
    level: "medium" as const,
    ts: "32분 전",
  },
  {
    id: "ra_3",
    userId: "u_429",
    reason: "신규 계정 고액 주문 4건 연속",
    level: "high" as const,
    ts: "1시간 전",
  },
  {
    id: "ra_4",
    userId: "u_502",
    reason: "OCR 입금증 위변조 의심",
    level: "medium" as const,
    ts: "2시간 전",
  },
];

export const MOCK_PENDING_MERCHANTS = [
  { id: "mr_1", name: "코인플러스", appliedAt: "2026-04-25", trades: 0, depositKrw: 50_000_000 },
  { id: "mr_2", name: "USDT 마켓", appliedAt: "2026-04-24", trades: 0, depositKrw: 30_000_000 },
];

export const MOCK_USERS_ADMIN = [
  {
    id: "u_001",
    name: "김토스",
    level: 3,
    trades: 12,
    status: "active" as const,
    risk: "Safe" as RiskTier,
  },
  {
    id: "u_213",
    name: "의심사용자",
    level: 1,
    trades: 3,
    status: "review" as const,
    risk: "Review" as RiskTier,
  },
  {
    id: "u_429",
    name: "신규고액",
    level: 2,
    trades: 4,
    status: "restricted" as const,
    risk: "Restricted" as RiskTier,
  },
  {
    id: "u_502",
    name: "박위변조",
    level: 2,
    trades: 8,
    status: "suspended" as const,
    risk: "Suspended" as RiskTier,
  },
];

export function fmtKrw(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}
export function fmtNum(n: number, max = 4) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: max });
}

// ============================================================
// P2P 환전소 — 환전 요청(주문) 목 데이터
// 거래소형 호가창이 아니라 "현재 진행중인 환전 요청"을 노출한다.
// ============================================================
export type SwapPair = "USDT/KRW" | "USDC/KRW" | "USDT/USD";
export type SwapSide = "buy" | "sell"; // buy = 코인 매수(원화 송금), sell = 코인 매도(원화 수령)
export type SwapReqStatus = "OPEN" | "MATCHING" | "IN_ESCROW" | "COMPLETED" | "CANCELLED";

export interface SwapRequest {
  id: string;
  pair: SwapPair;
  side: SwapSide;
  unitPrice: number; // KRW per 1 token (시장가는 0)
  isMarket: boolean;
  amountToken: number;
  filledToken: number;
  ownerName: string;
  ownerIsMerchant: boolean;
  ownerLevel: VerificationLevel;
  banks: Bank[];
  status: SwapReqStatus;
  createdAt: string;
  expectedFillSec?: number;
  isMine?: boolean;
}

// 페어별 시장 요약
export const MOCK_PAIR_STATS: Record<
  SwapPair,
  {
    midPrice: number;
    change24h: number;
    bestBuy: number;
    bestSell: number;
    openBuyToken: number;
    openSellToken: number;
    avgFillSec: number;
    todayDeals: number;
  }
> = {
  "USDT/KRW": {
    midPrice: 1387,
    change24h: 0.42,
    bestBuy: 1387,
    bestSell: 1386,
    openBuyToken: 18_240,
    openSellToken: 24_580,
    avgFillSec: 62,
    todayDeals: 1284,
  },
  "USDC/KRW": {
    midPrice: 1389,
    change24h: 0.31,
    bestBuy: 1389,
    bestSell: 1387,
    openBuyToken: 6_120,
    openSellToken: 8_450,
    avgFillSec: 110,
    todayDeals: 412,
  },
  "USDT/USD": {
    midPrice: 1.001,
    change24h: 0.02,
    bestBuy: 1.002,
    bestSell: 1.0,
    openBuyToken: 4_800,
    openSellToken: 5_200,
    avgFillSec: 180,
    todayDeals: 92,
  },
};

// 진행중 환전 요청
export const MOCK_SWAP_OPEN: SwapRequest[] = [
  // 매도(sell): 코인을 팔겠다 → 구매자에게 노출
  {
    id: "sw_o1",
    pair: "USDT/KRW",
    side: "sell",
    unitPrice: 1386,
    isMarket: false,
    amountToken: 7_250,
    filledToken: 1_820,
    ownerName: "EXPEER 머천트 #001",
    ownerIsMerchant: true,
    ownerLevel: 5,
    banks: ["토스뱅크", "KB국민"],
    status: "MATCHING",
    createdAt: "14:31:02",
    expectedFillSec: 45,
  },
  {
    id: "sw_o2",
    pair: "USDT/KRW",
    side: "sell",
    unitPrice: 1387,
    isMarket: false,
    amountToken: 5_400,
    filledToken: 0,
    ownerName: "스테이블허브",
    ownerIsMerchant: true,
    ownerLevel: 5,
    banks: ["토스뱅크", "카카오뱅크"],
    status: "OPEN",
    createdAt: "14:30:48",
    expectedFillSec: 90,
  },
  {
    id: "sw_o3",
    pair: "USDT/KRW",
    side: "sell",
    unitPrice: 1388,
    isMarket: false,
    amountToken: 3_120,
    filledToken: 0,
    ownerName: "코인브릿지",
    ownerIsMerchant: true,
    ownerLevel: 4,
    banks: ["KB국민", "신한"],
    status: "OPEN",
    createdAt: "14:29:55",
    expectedFillSec: 180,
  },
  {
    id: "sw_o4",
    pair: "USDT/KRW",
    side: "sell",
    unitPrice: 1390,
    isMarket: false,
    amountToken: 1_200,
    filledToken: 0,
    ownerName: "박상훈",
    ownerIsMerchant: false,
    ownerLevel: 3,
    banks: ["토스뱅크"],
    status: "OPEN",
    createdAt: "14:25:12",
    expectedFillSec: 480,
  },
  // 매수(buy): 코인을 사겠다 → 판매자에게 노출
  {
    id: "sw_o5",
    pair: "USDT/KRW",
    side: "buy",
    unitPrice: 1386,
    isMarket: false,
    amountToken: 4_200,
    filledToken: 980,
    ownerName: "이수민",
    ownerIsMerchant: false,
    ownerLevel: 3,
    banks: ["신한"],
    status: "MATCHING",
    createdAt: "14:30:30",
    expectedFillSec: 60,
  },
  {
    id: "sw_o6",
    pair: "USDT/KRW",
    side: "buy",
    unitPrice: 1385,
    isMarket: false,
    amountToken: 2_540,
    filledToken: 0,
    ownerName: "스테이블허브",
    ownerIsMerchant: true,
    ownerLevel: 5,
    banks: ["토스뱅크", "KB국민"],
    status: "OPEN",
    createdAt: "14:28:21",
    expectedFillSec: 120,
  },
  {
    id: "sw_o7",
    pair: "USDT/KRW",
    side: "buy",
    unitPrice: 0,
    isMarket: true,
    amountToken: 800,
    filledToken: 0,
    ownerName: "신규유저",
    ownerIsMerchant: false,
    ownerLevel: 3,
    banks: ["카카오뱅크"],
    status: "OPEN",
    createdAt: "14:31:40",
    expectedFillSec: 30,
  },
  {
    id: "sw_o8",
    pair: "USDT/KRW",
    side: "buy",
    unitPrice: 1383,
    isMarket: false,
    amountToken: 6_500,
    filledToken: 0,
    ownerName: "코인브릿지",
    ownerIsMerchant: true,
    ownerLevel: 4,
    banks: ["KB국민"],
    status: "OPEN",
    createdAt: "14:22:08",
    expectedFillSec: 360,
  },
];

// 완료된 환전 요청
export const MOCK_SWAP_DONE: SwapRequest[] = [
  {
    id: "sw_d1",
    pair: "USDT/KRW",
    side: "sell",
    unitPrice: 1387,
    isMarket: false,
    amountToken: 540,
    filledToken: 540,
    ownerName: "스테이블허브",
    ownerIsMerchant: true,
    ownerLevel: 5,
    banks: ["카카오뱅크"],
    status: "COMPLETED",
    createdAt: "14:30:18",
    expectedFillSec: 38,
  },
  {
    id: "sw_d2",
    pair: "USDT/KRW",
    side: "buy",
    unitPrice: 1387,
    isMarket: false,
    amountToken: 320,
    filledToken: 320,
    ownerName: "김토스",
    ownerIsMerchant: false,
    ownerLevel: 3,
    banks: ["토스뱅크"],
    status: "COMPLETED",
    createdAt: "14:30:11",
    expectedFillSec: 52,
  },
  {
    id: "sw_d3",
    pair: "USDT/KRW",
    side: "sell",
    unitPrice: 1386,
    isMarket: false,
    amountToken: 180,
    filledToken: 180,
    ownerName: "EXPEER 머천트 #001",
    ownerIsMerchant: true,
    ownerLevel: 5,
    banks: ["토스뱅크"],
    status: "COMPLETED",
    createdAt: "14:30:04",
    expectedFillSec: 41,
  },
  {
    id: "sw_d4",
    pair: "USDT/KRW",
    side: "buy",
    unitPrice: 1388,
    isMarket: true,
    amountToken: 1_200,
    filledToken: 1_200,
    ownerName: "박상훈",
    ownerIsMerchant: false,
    ownerLevel: 3,
    banks: ["신한"],
    status: "COMPLETED",
    createdAt: "14:31:56",
    expectedFillSec: 28,
  },
  {
    id: "sw_d5",
    pair: "USDT/KRW",
    side: "sell",
    unitPrice: 1386,
    isMarket: false,
    amountToken: 420,
    filledToken: 420,
    ownerName: "코인브릿지",
    ownerIsMerchant: true,
    ownerLevel: 4,
    banks: ["KB국민"],
    status: "COMPLETED",
    createdAt: "14:31:48",
    expectedFillSec: 64,
  },
  {
    id: "sw_d6",
    pair: "USDT/KRW",
    side: "buy",
    unitPrice: 1387,
    isMarket: false,
    amountToken: 760,
    filledToken: 760,
    ownerName: "이수민",
    ownerIsMerchant: false,
    ownerLevel: 3,
    banks: ["카카오뱅크"],
    status: "COMPLETED",
    createdAt: "14:31:39",
    expectedFillSec: 88,
  },
  {
    id: "sw_d7",
    pair: "USDT/KRW",
    side: "sell",
    unitPrice: 1385,
    isMarket: false,
    amountToken: 220,
    filledToken: 220,
    ownerName: "EXPEER 머천트 #001",
    ownerIsMerchant: true,
    ownerLevel: 5,
    banks: ["신한"],
    status: "COMPLETED",
    createdAt: "14:31:30",
    expectedFillSec: 35,
  },
  {
    id: "sw_d8",
    pair: "USDT/KRW",
    side: "buy",
    unitPrice: 1388,
    isMarket: false,
    amountToken: 980,
    filledToken: 980,
    ownerName: "스테이블허브",
    ownerIsMerchant: true,
    ownerLevel: 5,
    banks: ["토스뱅크"],
    status: "COMPLETED",
    createdAt: "14:31:22",
    expectedFillSec: 71,
  },
];

// 가격 구간별 평균 체결시간 가이드 (낮게 팔수록 빠름)
export const MOCK_FILL_GUIDE: { delta: number; avgSec: number; label: string }[] = [
  { delta: -2, avgSec: 25, label: "즉시 체결" },
  { delta: -1, avgSec: 60, label: "1분 이내" },
  { delta: 0, avgSec: 120, label: "보통" },
  { delta: +1, avgSec: 300, label: "5분 이상" },
  { delta: +2, avgSec: 720, label: "오래 걸림" },
];

export const MOCK_MARKET_STATS = {
  volume24hToken: 2_840_500,
  volume24hKrw: 3_942_700_000,
  high24h: 1394,
  low24h: 1378,
  activeMerchants: 38,
  liveOrders: 412,
  avgReleaseSec: 62,
};

// ============================================================
// P2P 교환 — 스테이블코인 ↔ 일반 암호화폐 교환 오퍼
// 법정화폐 없이 코인끼리만 교환. 비율(rate) 기반.
// ============================================================
export type CryptoAsset =
  | "USDT"
  | "USDC"
  | "DAI" // 스테이블
  | "BTC"
  | "ETH"
  | "SOL"
  | "MATIC"
  | "BNB"
  | "XRP"; // 일반

export const STABLE_ASSETS: CryptoAsset[] = ["USDT", "USDC", "DAI"];
export const VOLATILE_ASSETS: CryptoAsset[] = ["BTC", "ETH", "SOL", "MATIC", "BNB", "XRP"];

// USD 기준 시세 (mock)
export const COIN_PRICE_USD: Record<CryptoAsset, number> = {
  USDT: 1.0,
  USDC: 1.0,
  DAI: 0.999,
  BTC: 95_240,
  ETH: 3_280,
  SOL: 184.5,
  MATIC: 0.62,
  BNB: 612,
  XRP: 0.58,
};

// 코인/법정화폐 메타 — 심볼·풀네임·브랜드 컬러
export interface AssetMeta {
  symbol: string; // 표시 약어 (USDT, BTC, ₿ 등)
  fullName: string;
  badge: string; // 아이콘 자리 텍스트 (3자 이내)
  color: string; // tailwind bg/text classes
}
export const ASSET_META: Record<CryptoAsset, AssetMeta> = {
  USDT: { symbol: "USDT", fullName: "Tether USD", badge: "₮", color: "bg-emerald-500 text-white" },
  USDC: { symbol: "USDC", fullName: "USD Coin", badge: "$", color: "bg-sky-500 text-white" },
  DAI: { symbol: "DAI", fullName: "Dai Stablecoin", badge: "◈", color: "bg-amber-500 text-white" },
  BTC: { symbol: "BTC", fullName: "Bitcoin", badge: "₿", color: "bg-orange-500 text-white" },
  ETH: { symbol: "ETH", fullName: "Ethereum", badge: "Ξ", color: "bg-indigo-500 text-white" },
  SOL: { symbol: "SOL", fullName: "Solana", badge: "◎", color: "bg-fuchsia-500 text-white" },
  MATIC: { symbol: "MATIC", fullName: "Polygon", badge: "⬡", color: "bg-violet-500 text-white" },
  BNB: { symbol: "BNB", fullName: "BNB Chain", badge: "◆", color: "bg-yellow-500 text-black" },
  XRP: { symbol: "XRP", fullName: "XRP", badge: "✕", color: "bg-slate-700 text-white" },
};

export type FiatCode = "KRW" | "USD" | "JPY" | "EUR";
export interface FiatMeta {
  code: FiatCode;
  symbol: string;
  fullName: string;
  flag: string;
}
export const FIAT_META: Record<FiatCode, FiatMeta> = {
  KRW: { code: "KRW", symbol: "₩", fullName: "대한민국 원", flag: "🇰🇷" },
  USD: { code: "USD", symbol: "$", fullName: "미국 달러", flag: "🇺🇸" },
  JPY: { code: "JPY", symbol: "¥", fullName: "일본 엔", flag: "🇯🇵" },
  EUR: { code: "EUR", symbol: "€", fullName: "유로", flag: "🇪🇺" },
};

export type SwapXSide = "give" | "take"; // give: 내가 from을 주겠다, take: 내가 from을 받겠다
export type SwapXStatus = "OPEN" | "MATCHING" | "IN_ESCROW" | "COMPLETED" | "CANCELLED";

export interface CryptoSwapOffer {
  id: string;
  fromAsset: CryptoAsset; // 제공 코인
  toAsset: CryptoAsset; // 원하는 코인
  fromAmount: number;
  toAmount: number; // 비율: toAmount / fromAmount
  premiumPct: number; // 시세 대비 프리미엄(+) / 디스카운트(-)
  ownerName: string;
  ownerIsMerchant: boolean;
  ownerLevel: VerificationLevel;
  status: SwapXStatus;
  createdAt: string;
  expectedFillSec?: number;
  filledFromAmount: number;
  isMine?: boolean;
}

export const MOCK_CRYPTO_SWAPS: CryptoSwapOffer[] = [
  // BTC ↔ USDT
  {
    id: "cx_1",
    fromAsset: "BTC",
    toAsset: "USDT",
    fromAmount: 0.5,
    toAmount: 47_620,
    premiumPct: 0,
    ownerName: "EXPEER 머천트 #001",
    ownerIsMerchant: true,
    ownerLevel: 5,
    status: "OPEN",
    createdAt: "14:30:11",
    expectedFillSec: 60,
    filledFromAmount: 0,
  },
  {
    id: "cx_2",
    fromAsset: "USDT",
    toAsset: "BTC",
    fromAmount: 95_240,
    toAmount: 0.998,
    premiumPct: -0.2,
    ownerName: "스테이블허브",
    ownerIsMerchant: true,
    ownerLevel: 5,
    status: "OPEN",
    createdAt: "14:29:44",
    expectedFillSec: 90,
    filledFromAmount: 0,
  },
  // ETH ↔ USDC
  {
    id: "cx_3",
    fromAsset: "ETH",
    toAsset: "USDC",
    fromAmount: 2.0,
    toAmount: 6_576,
    premiumPct: 0.24,
    ownerName: "코인브릿지",
    ownerIsMerchant: true,
    ownerLevel: 4,
    status: "MATCHING",
    createdAt: "14:31:02",
    expectedFillSec: 45,
    filledFromAmount: 0.5,
  },
  {
    id: "cx_4",
    fromAsset: "USDC",
    toAsset: "ETH",
    fromAmount: 3_280,
    toAmount: 0.997,
    premiumPct: -0.3,
    ownerName: "박상훈",
    ownerIsMerchant: false,
    ownerLevel: 3,
    status: "OPEN",
    createdAt: "14:25:33",
    expectedFillSec: 240,
    filledFromAmount: 0,
  },
  // SOL ↔ USDT
  {
    id: "cx_5",
    fromAsset: "SOL",
    toAsset: "USDT",
    fromAmount: 50,
    toAmount: 9_270,
    premiumPct: 0.49,
    ownerName: "이수민",
    ownerIsMerchant: false,
    ownerLevel: 3,
    status: "OPEN",
    createdAt: "14:28:12",
    expectedFillSec: 180,
    filledFromAmount: 0,
  },
  // MATIC ↔ USDT
  {
    id: "cx_6",
    fromAsset: "USDT",
    toAsset: "MATIC",
    fromAmount: 620,
    toAmount: 1_005,
    premiumPct: 0.5,
    ownerName: "EXPEER 머천트 #001",
    ownerIsMerchant: true,
    ownerLevel: 5,
    status: "OPEN",
    createdAt: "14:31:25",
    expectedFillSec: 70,
    filledFromAmount: 0,
  },
  // BNB ↔ USDT
  {
    id: "cx_7",
    fromAsset: "BNB",
    toAsset: "USDT",
    fromAmount: 5,
    toAmount: 3_062,
    premiumPct: 0.07,
    ownerName: "스테이블허브",
    ownerIsMerchant: true,
    ownerLevel: 5,
    status: "OPEN",
    createdAt: "14:30:55",
    expectedFillSec: 80,
    filledFromAmount: 0,
  },
  // XRP ↔ USDC
  {
    id: "cx_8",
    fromAsset: "XRP",
    toAsset: "USDC",
    fromAmount: 5_000,
    toAmount: 2_905,
    premiumPct: 0.17,
    ownerName: "코인브릿지",
    ownerIsMerchant: true,
    ownerLevel: 4,
    status: "OPEN",
    createdAt: "14:30:40",
    expectedFillSec: 110,
    filledFromAmount: 0,
  },
  // ===== 일반코인 ↔ 일반코인 직접 교환 =====
  // BTC ↔ ETH
  {
    id: "cx_9",
    fromAsset: "BTC",
    toAsset: "ETH",
    fromAmount: 0.25,
    toAmount: 7.26,
    premiumPct: 0.05,
    ownerName: "EXPEER 머천트 #001",
    ownerIsMerchant: true,
    ownerLevel: 5,
    status: "OPEN",
    createdAt: "14:31:18",
    expectedFillSec: 90,
    filledFromAmount: 0,
  },
  {
    id: "cx_10",
    fromAsset: "ETH",
    toAsset: "BTC",
    fromAmount: 10,
    toAmount: 0.343,
    premiumPct: -0.4,
    ownerName: "스테이블허브",
    ownerIsMerchant: true,
    ownerLevel: 5,
    status: "OPEN",
    createdAt: "14:30:02",
    expectedFillSec: 120,
    filledFromAmount: 0,
  },
  // ETH ↔ SOL
  {
    id: "cx_11",
    fromAsset: "ETH",
    toAsset: "SOL",
    fromAmount: 1,
    toAmount: 17.66,
    premiumPct: -0.5,
    ownerName: "코인브릿지",
    ownerIsMerchant: true,
    ownerLevel: 4,
    status: "OPEN",
    createdAt: "14:29:11",
    expectedFillSec: 150,
    filledFromAmount: 0,
  },
  // SOL ↔ MATIC
  {
    id: "cx_12",
    fromAsset: "SOL",
    toAsset: "MATIC",
    fromAmount: 5,
    toAmount: 1_485,
    premiumPct: -0.2,
    ownerName: "박상훈",
    ownerIsMerchant: false,
    ownerLevel: 3,
    status: "OPEN",
    createdAt: "14:27:44",
    expectedFillSec: 240,
    filledFromAmount: 0,
  },
  // BNB ↔ ETH
  {
    id: "cx_13",
    fromAsset: "BNB",
    toAsset: "ETH",
    fromAmount: 10,
    toAmount: 1.86,
    premiumPct: -0.3,
    ownerName: "이수민",
    ownerIsMerchant: false,
    ownerLevel: 3,
    status: "OPEN",
    createdAt: "14:26:35",
    expectedFillSec: 200,
    filledFromAmount: 0,
  },
  // XRP ↔ BTC
  {
    id: "cx_14",
    fromAsset: "XRP",
    toAsset: "BTC",
    fromAmount: 10_000,
    toAmount: 0.0608,
    premiumPct: -0.1,
    ownerName: "EXPEER 머천트 #001",
    ownerIsMerchant: true,
    ownerLevel: 5,
    status: "OPEN",
    createdAt: "14:24:50",
    expectedFillSec: 180,
    filledFromAmount: 0,
  },
];

// ============================================================
// 활동 채팅 세션 — 매칭/체결시 자동 오픈, 완료 후 24h 유효
// ============================================================
export type ActivityKind = "fiat" | "crypto"; // P2P환전 / P2P교환
export type ActivityStatus = "MATCHED" | "IN_PROGRESS" | "COMPLETED" | "EXPIRED";

export interface ActivitySession {
  id: string;
  kind: ActivityKind;
  title: string; // 예: "USDT 720 → KRW 998,640" or "0.5 BTC → 47,620 USDT"
  counterpartName: string;
  counterpartIsMerchant: boolean;
  status: ActivityStatus;
  matchedAt: string; // 시각 표기
  completedAt?: string;
  chatExpiresAt?: string; // 완료 후 24h
  unread: number;
  lastMessage?: string;
  amountLabel: string;
}

export const MOCK_ACTIVITY: ActivitySession[] = [
  {
    id: "act_1",
    kind: "fiat",
    title: "USDT 720 매도 → KRW 998,640",
    counterpartName: "EXPEER 머천트 #001",
    counterpartIsMerchant: true,
    status: "IN_PROGRESS",
    matchedAt: "14:30",
    unread: 2,
    lastMessage: "안녕하세요, 입금 후 알려주세요.",
    amountLabel: "720 USDT",
  },
  {
    id: "act_2",
    kind: "crypto",
    title: "0.5 BTC → 47,620 USDT",
    counterpartName: "스테이블허브",
    counterpartIsMerchant: true,
    status: "MATCHED",
    matchedAt: "14:31",
    unread: 1,
    lastMessage: "교환 진행하시죠.",
    amountLabel: "0.5 BTC ↔ 47,620 USDT",
  },
  {
    id: "act_3",
    kind: "fiat",
    title: "USDT 360 매수 → KRW 498,960",
    counterpartName: "스테이블허브",
    counterpartIsMerchant: true,
    status: "COMPLETED",
    matchedAt: "09:12",
    completedAt: "09:18",
    chatExpiresAt: "내일 09:18까지",
    unread: 0,
    lastMessage: "거래 감사합니다 :)",
    amountLabel: "360 USDT",
  },
  {
    id: "act_4",
    kind: "crypto",
    title: "2.0 ETH → 6,576 USDC",
    counterpartName: "코인브릿지",
    counterpartIsMerchant: true,
    status: "IN_PROGRESS",
    matchedAt: "14:28",
    unread: 0,
    lastMessage: "락업 확인했어요.",
    amountLabel: "2.0 ETH ↔ 6,576 USDC",
  },
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  ESCROW_PENDING: "에스크로 락업 중",
  ESCROW_FUNDED: "락업 완료",
  PAYMENT_PENDING: "송금 대기",
  PAYMENT_MARKED: "입금완료 표시됨",
  SELLER_REVIEWING: "판매자 확인 중",
  RELEASED: "거래 완료",
  CANCELLED: "취소됨",
  EXPIRED: "만료됨",
  DISPUTED: "분쟁 중",
  REFUNDED: "환불됨",
};
