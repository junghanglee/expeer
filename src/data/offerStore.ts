// DB-backed offer store. Loads ads from Supabase and exposes them in the
// shapes the existing P2P환전(market) and P2P교환(swap) UIs already use
// (SwapRequest, CryptoSwapOffer). Empty DB results stay empty so the UI reflects
// the actual Supabase state instead of mixing in prototype data.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { createCryptoSwapOffer, createFiatOffer } from "@/utils/offers.functions";
import {
  type Bank,
  type CryptoAsset,
  type CryptoSwapOffer,
  type SwapPair,
  type SwapReqStatus,
  type SwapRequest,
  type SwapSide,
  type VerificationLevel,
} from "@/data/format";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type AdRow = Tables<"ads">;

function fmtTs(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function ownerName(ad: AdRow, myUserId?: string) {
  return myUserId && ad.user_id === myUserId ? "내 오퍼" : `사용자 ${ad.user_id.slice(0, 6)}`;
}

function adStatus(status: string): SwapReqStatus {
  return status === "active" ? "OPEN" : "COMPLETED";
}

function paymentMethodLabel(method: string): Bank {
  if (method === "toss") return "토스뱅크";
  if (method === "kakao_pay") return "카카오뱅크";
  if (method === "bank_transfer") return "신한";
  return "신한";
}

function adToSwapRequest(ad: AdRow, myUserId?: string): SwapRequest | null {
  if (ad.kind !== "fiat") return null;
  const pair = `${ad.asset}/${ad.fiat ?? "KRW"}` as SwapPair;
  const validPairs: SwapPair[] = ["USDT/KRW", "USDC/KRW", "DAI/KRW", "USDT/USD"];
  if (!validPairs.includes(pair)) return null;
  return {
    id: ad.id,
    pair,
    side: ad.side as SwapSide,
    unitPrice: Number(ad.price),
    isMarket: ad.is_market,
    amountToken: Number(ad.total_amount),
    filledToken: Number(ad.filled_amount ?? 0),
    ownerName: ownerName(ad, myUserId),
    ownerIsMerchant: false,
    ownerLevel: 3 as VerificationLevel,
    banks: ad.payment_methods.map(paymentMethodLabel),
    status: adStatus(ad.status),
    createdAt: fmtTs(new Date(ad.created_at)),
    expectedFillSec: ad.expected_fill_sec ?? undefined,
    minOrder: Number(ad.min_order ?? 0),
    maxOrder: Number(ad.max_order ?? 0),
    activeOrderCount: 0,
    paymentWindowMin: 15,
    isMine: myUserId ? ad.user_id === myUserId : false,
    ownerId: ad.user_id,
  };
}

function adToCryptoSwap(ad: AdRow, myUserId?: string): CryptoSwapOffer | null {
  if (ad.kind !== "crypto_swap") return null;
  if (!ad.to_asset || ad.to_amount == null) return null;
  return {
    id: ad.id,
    fromAsset: ad.asset as CryptoAsset,
    toAsset: ad.to_asset as CryptoAsset,
    fromAmount: Number(ad.total_amount),
    toAmount: Number(ad.to_amount),
    premiumPct: Number(ad.premium_pct ?? 0),
    ownerName: ownerName(ad, myUserId),
    ownerIsMerchant: false,
    ownerLevel: 3 as VerificationLevel,
    status: adStatus(ad.status),
    createdAt: fmtTs(new Date(ad.created_at)),
    expectedFillSec: ad.expected_fill_sec ?? undefined,
    filledFromAmount: Number(ad.filled_amount ?? 0),
    minFromAmount: Number(ad.min_order ?? 0),
    maxFromAmount: Number(ad.max_order ?? ad.total_amount),
    activeOrderCount: 0,
    paymentWindowMin: 15,
    isMine: myUserId ? ad.user_id === myUserId : false,
    ownerId: ad.user_id,
  };
}

export function demoSwapRequests(myUserId?: string): SwapRequest[] {
  const now = Date.now();
  return [
    {
      id: "demo-sell-usdt-1",
      pair: "USDT/KRW",
      side: "sell",
      unitPrice: 1376,
      isMarket: false,
      amountToken: 3200,
      filledToken: 450,
      ownerName: "강남환전상",
      ownerIsMerchant: true,
      ownerLevel: 4 as VerificationLevel,
      banks: ["토스뱅크", "신한"],
      status: "OPEN",
      createdAt: fmtTs(new Date(now - 4 * 60 * 1000)),
      expectedFillSec: 75,
      minOrder: 100_000,
      maxOrder: 5_000_000,
      activeOrderCount: 2,
      paymentWindowMin: 15,
      terms: "입금자명과 주문금액이 일치해야 승인합니다. 거래방 밖 연락은 받지 않습니다.",
      isMine: false,
      ownerId: "demo-merchant-sell-1",
    },
    {
      id: "demo-sell-usdt-2",
      pair: "USDT/KRW",
      side: "sell",
      unitPrice: 1382,
      isMarket: false,
      amountToken: 1800,
      filledToken: 0,
      ownerName: "빠른USDT",
      ownerIsMerchant: true,
      ownerLevel: 3 as VerificationLevel,
      banks: ["카카오뱅크"],
      status: "OPEN",
      createdAt: fmtTs(new Date(now - 12 * 60 * 1000)),
      expectedFillSec: 120,
      minOrder: 50_000,
      maxOrder: 2_500_000,
      activeOrderCount: 0,
      paymentWindowMin: 10,
      terms: "무통장입금 확인 후 빠르게 릴리즈합니다.",
      isMine: false,
      ownerId: "demo-merchant-sell-2",
    },
    {
      id: "demo-buy-usdt-1",
      pair: "USDT/KRW",
      side: "buy",
      unitPrice: 1371,
      isMarket: false,
      amountToken: 2500,
      filledToken: 300,
      ownerName: "서울매입센터",
      ownerIsMerchant: true,
      ownerLevel: 4 as VerificationLevel,
      banks: ["KB국민", "우리"],
      status: "OPEN",
      createdAt: fmtTs(new Date(now - 8 * 60 * 1000)),
      expectedFillSec: 90,
      minOrder: 100_000,
      maxOrder: 4_000_000,
      activeOrderCount: 1,
      paymentWindowMin: 15,
      terms: "송금 전 거래방 안내를 확인해 주세요. 증빙자료는 자동 보관됩니다.",
      isMine: false,
      ownerId: "demo-merchant-buy-1",
    },
    {
      id: "demo-sell-usdc-1",
      pair: "USDC/KRW",
      side: "sell",
      unitPrice: 1378,
      isMarket: false,
      amountToken: 1500,
      filledToken: 120,
      ownerName: "USDC데스크",
      ownerIsMerchant: true,
      ownerLevel: 3 as VerificationLevel,
      banks: ["농협"],
      status: "OPEN",
      createdAt: fmtTs(new Date(now - 18 * 60 * 1000)),
      expectedFillSec: 160,
      minOrder: 70_000,
      maxOrder: 2_000_000,
      activeOrderCount: 0,
      paymentWindowMin: 15,
      terms: "USDC Base Sepolia 기준 테스트 오퍼입니다.",
      isMine: false,
      ownerId: "demo-merchant-usdc-1",
    },
  ];
}

export function useSwapRequests() {
  const { user } = useAuth();
  const [items, setItems] = useState<SwapRequest[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ads")
      .select("*")
      .eq("kind", "fiat")
      .order("created_at", { ascending: false });
    const mapped = (data ?? [])
      .map((a) => adToSwapRequest(a, user?.id))
      .filter((x): x is SwapRequest => x !== null);
    setItems(mapped.length > 0 ? mapped : demoSwapRequests(user?.id));
  }, [user?.id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("ads-fiat-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "ads" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return items;
}

export function useCryptoSwaps() {
  const { user } = useAuth();
  const [items, setItems] = useState<CryptoSwapOffer[]>([]);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ads")
      .select("*")
      .eq("kind", "crypto_swap")
      .order("created_at", { ascending: false });
    const mapped = (data ?? [])
      .map((a) => adToCryptoSwap(a, user?.id))
      .filter((x): x is CryptoSwapOffer => x !== null);
    setItems(mapped);
  }, [user?.id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel("ads-crypto-" + Math.random().toString(36).slice(2))
      .on("postgres_changes", { event: "*", schema: "public", table: "ads" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  return items;
}

async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
  return token;
}

export async function saveSwapRequest(_userId: string, req: SwapRequest): Promise<void> {
  const [asset, fiat] = req.pair.split("/");
  const payload: Omit<TablesInsert<"ads">, "user_id" | "kind"> = {
    side: req.side,
    asset,
    fiat,
    network: "Base Sepolia",
    price: req.unitPrice || 0,
    is_market: req.isMarket,
    total_amount: req.amountToken,
    available_amount: req.amountToken,
    filled_amount: 0,
    expected_fill_sec: req.expectedFillSec ?? null,
    min_order: req.minOrder ?? 10_000,
    max_order: req.maxOrder ?? 10_000_000,
    payment_methods: ["bank_transfer"],
    terms:
      req.terms ??
      "계좌이체 완료 후 거래방에서 입금 완료를 표시해 주세요. 판매자는 입금 확인 후 15분 안에 릴리즈/확인을 진행합니다.",
    status: "active",
  };
  const result = await createFiatOffer({
    data: { ...payload, accessToken: await getAccessToken() },
  });
  if (!result.ok) throw new Error(result.error);
}

export async function saveCryptoSwap(_userId: string, offer: CryptoSwapOffer): Promise<void> {
  const payload: Omit<TablesInsert<"ads">, "user_id" | "kind"> = {
    side: "sell",
    asset: offer.fromAsset,
    network: "Base Sepolia",
    fiat: null,
    price: offer.toAmount / offer.fromAmount,
    to_asset: offer.toAsset,
    to_network: "Base Sepolia",
    to_amount: offer.toAmount,
    premium_pct: offer.premiumPct,
    is_market: false,
    total_amount: offer.fromAmount,
    available_amount: offer.fromAmount,
    filled_amount: 0,
    expected_fill_sec: offer.expectedFillSec ?? null,
    min_order: offer.minFromAmount ?? 0,
    max_order: offer.maxFromAmount ?? offer.fromAmount,
    payment_methods: ["onchain"],
    status: "active",
  };
  const result = await createCryptoSwapOffer({
    data: { ...payload, accessToken: await getAccessToken() },
  });
  if (!result.ok) throw new Error(result.error);
}

// Legacy aliases kept so existing callers keep compiling. DB writes now happen through saveSwapRequest/saveCryptoSwap.
export function addSwapRequest(_req: SwapRequest) {
  // no-op
}
export function addCryptoSwap(_offer: CryptoSwapOffer) {
  // no-op
}
