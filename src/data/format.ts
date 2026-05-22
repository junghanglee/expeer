export const STABLE_ASSETS = ["USDT", "USDC", "DAI"] as const;
export const VOLATILE_ASSETS = ["BTC", "ETH", "SOL", "MATIC", "BNB", "XRP"] as const;

export type CryptoAsset = "USDT" | "USDC" | "DAI" | "BTC" | "ETH" | "SOL" | "MATIC" | "BNB" | "XRP";
export type FiatCode = "KRW" | "USD" | "JPY" | "EUR";
export type SwapPair = "USDT/KRW" | "USDC/KRW" | "DAI/KRW" | "USDT/USD";
export type SwapSide = "buy" | "sell";
export type SwapReqStatus = "OPEN" | "MATCHING" | "IN_ESCROW" | "COMPLETED" | "CANCELLED";
export type RiskTier = "Safe" | "Standard" | "Restricted" | "Review" | "Suspended";
export type VerificationLevel = 0 | 1 | 2 | 3 | 4 | 5;
export type Bank = "토스뱅크" | "KB국민" | "신한" | "카카오뱅크" | "우리" | "농협";

export interface SwapRequest {
  id: string;
  pair: SwapPair;
  side: SwapSide;
  unitPrice: number;
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
  minOrder?: number;
  maxOrder?: number;
  activeOrderCount?: number;
  paymentWindowMin?: number;
  terms?: string | null;
  isMine?: boolean;
  ownerId?: string;
}

export type SwapXSide = "give" | "take";
export type SwapXStatus = "OPEN" | "MATCHING" | "IN_ESCROW" | "COMPLETED" | "CANCELLED";

export interface CryptoSwapOffer {
  id: string;
  fromAsset: CryptoAsset;
  toAsset: CryptoAsset;
  fromAmount: number;
  toAmount: number;
  premiumPct: number;
  ownerName: string;
  ownerIsMerchant: boolean;
  ownerLevel: VerificationLevel;
  status: SwapXStatus;
  createdAt: string;
  expectedFillSec?: number;
  filledFromAmount: number;
  minFromAmount?: number;
  maxFromAmount?: number;
  activeOrderCount?: number;
  paymentWindowMin?: number;
  isMine?: boolean;
  ownerId?: string;
}

export interface PairStats {
  midPrice: number;
  change24h: number;
  bestBuy: number;
  bestSell: number;
  openBuyToken: number;
  openSellToken: number;
  avgFillSec: number;
  todayDeals: number;
}

export interface AssetMeta {
  symbol: string;
  fullName: string;
  badge: string;
  color: string;
}

export interface FiatMeta {
  code: FiatCode;
  symbol: string;
  fullName: string;
  flag: string;
}

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

export const FIAT_META: Record<FiatCode, FiatMeta> = {
  KRW: { code: "KRW", symbol: "₩", fullName: "대한민국 원", flag: "🇰🇷" },
  USD: { code: "USD", symbol: "$", fullName: "미국 달러", flag: "🇺🇸" },
  JPY: { code: "JPY", symbol: "¥", fullName: "일본 엔", flag: "🇯🇵" },
  EUR: { code: "EUR", symbol: "€", fullName: "유로", flag: "🇪🇺" },
};

export function fmtNum(n: number, digits = 0) {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(n);
}

export function fmtKrw(n: number) {
  return `${fmtNum(Math.round(n), 0)}원`;
}

export function makePairStats(
  pair: SwapPair,
  offers: SwapRequest[],
  fallbackMidPrice = 0,
): PairStats {
  const open = offers.filter((offer) => offer.pair === pair && offer.status === "OPEN");
  const sellOffers = open.filter((offer) => offer.side === "sell");
  const buyOffers = open.filter((offer) => offer.side === "buy");
  const priceOf = (offer: SwapRequest) => (offer.isMarket ? fallbackMidPrice : offer.unitPrice);
  const sellPrices = sellOffers.map(priceOf).filter((price) => Number.isFinite(price) && price > 0);
  const buyPrices = buyOffers.map(priceOf).filter((price) => Number.isFinite(price) && price > 0);
  const prices = [...sellPrices, ...buyPrices];
  const midPrice =
    fallbackMidPrice ||
    (prices.length ? prices.reduce((sum, price) => sum + price, 0) / prices.length : 0);
  const remain = (offer: SwapRequest) => Math.max(0, offer.amountToken - offer.filledToken);
  return {
    midPrice,
    change24h: 0,
    bestBuy: buyPrices.length ? Math.max(...buyPrices) : midPrice,
    bestSell: sellPrices.length ? Math.min(...sellPrices) : midPrice,
    openBuyToken: buyOffers.reduce((sum, offer) => sum + remain(offer), 0),
    openSellToken: sellOffers.reduce((sum, offer) => sum + remain(offer), 0),
    avgFillSec: 0,
    todayDeals: 0,
  };
}

export const FILL_GUIDE = [
  { delta: -2, avgSec: 45, label: "빠른 체결" },
  { delta: -0.5, avgSec: 90, label: "보통보다 빠름" },
  { delta: 0, avgSec: 180, label: "보통" },
  { delta: 2, avgSec: 420, label: "느림" },
  { delta: 4, avgSec: 900, label: "매우 느림" },
] as const;
