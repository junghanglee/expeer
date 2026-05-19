// DB-backed offer store. Loads ads from Supabase and exposes them in the
// shapes the existing P2P 환전(market) and P2P 교환(swap) UIs already use
// (SwapRequest, CryptoSwapOffer). Falls back to mock data when the DB is empty
// or the user is signed-out, so the prototype remains explorable.
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { createCryptoSwapOffer, createFiatOffer } from "@/utils/offers.functions";
import {
  MOCK_SWAP_OPEN,
  MOCK_CRYPTO_SWAPS,
  type SwapRequest,
  type SwapPair,
  type SwapSide,
  type SwapReqStatus,
  type CryptoSwapOffer,
  type CryptoAsset,
  type VerificationLevel,
} from "@/data/mock";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

type AdRow = Tables<"ads">;

// ---------- helpers ----------
function fmtTs(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

function adToSwapRequest(ad: AdRow, myUserId?: string): SwapRequest | null {
  if (ad.kind !== "fiat") return null;
  const pair = `${ad.asset}/${ad.fiat ?? "KRW"}` as SwapPair;
  const validPairs: SwapPair[] = ["USDT/KRW", "USDC/KRW", "USDT/USD"];
  if (!validPairs.includes(pair)) return null;
  return {
    id: ad.id,
    pair,
    side: ad.side as SwapSide,
    unitPrice: Number(ad.price),
    isMarket: ad.is_market,
    amountToken: Number(ad.total_amount),
    filledToken: Number(ad.filled_amount ?? 0),
    ownerName: myUserId && ad.user_id === myUserId ? "나" : `사용자 ${ad.user_id.slice(0, 6)}`,
    ownerIsMerchant: false,
    ownerLevel: 3 as VerificationLevel,
    banks: [],
    status: (ad.status === "active" ? "OPEN" : "COMPLETED") as SwapReqStatus,
    createdAt: fmtTs(new Date(ad.created_at)),
    expectedFillSec: ad.expected_fill_sec ?? undefined,
    isMine: myUserId ? ad.user_id === myUserId : false,
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
    ownerName: myUserId && ad.user_id === myUserId ? "나" : `사용자 ${ad.user_id.slice(0, 6)}`,
    ownerIsMerchant: false,
    ownerLevel: 3 as VerificationLevel,
    status: ad.status === "active" ? "OPEN" : "COMPLETED",
    createdAt: fmtTs(new Date(ad.created_at)),
    expectedFillSec: ad.expected_fill_sec ?? undefined,
    filledFromAmount: Number(ad.filled_amount ?? 0),
    isMine: myUserId ? ad.user_id === myUserId : false,
  };
}

// ---------- hooks ----------
export function useSwapRequests() {
  const { user } = useAuth();
  const [items, setItems] = useState<SwapRequest[]>(MOCK_SWAP_OPEN);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ads")
      .select("*")
      .eq("kind", "fiat")
      .order("created_at", { ascending: false });
    const mapped = (data ?? [])
      .map((a) => adToSwapRequest(a, user?.id))
      .filter((x): x is SwapRequest => x !== null);
    setItems([...mapped, ...MOCK_SWAP_OPEN]);
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
  const [items, setItems] = useState<CryptoSwapOffer[]>(MOCK_CRYPTO_SWAPS);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("ads")
      .select("*")
      .eq("kind", "crypto_swap")
      .order("created_at", { ascending: false });
    const mapped = (data ?? [])
      .map((a) => adToCryptoSwap(a, user?.id))
      .filter((x): x is CryptoSwapOffer => x !== null);
    setItems([...mapped, ...MOCK_CRYPTO_SWAPS]);
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

// ---------- writes ----------
async function getAccessToken() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
  return token;
}

export async function saveSwapRequest(userId: string, req: SwapRequest): Promise<void> {
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
    min_order: 10_000,
    max_order: 10_000_000,
    payment_methods: ["bank_transfer"],
    status: "active",
  };
  const result = await createFiatOffer({
    data: { ...payload, accessToken: await getAccessToken() },
  });
  if (!result.ok) throw new Error(result.error);
}

export async function saveCryptoSwap(userId: string, offer: CryptoSwapOffer): Promise<void> {
  const payload: Omit<TablesInsert<"ads">, "user_id" | "kind"> = {
    side: "sell",
    asset: offer.fromAsset,
    network: "Base Sepolia",
    fiat: null,
    price: offer.toAmount / offer.fromAmount, // unit rate
    to_asset: offer.toAsset,
    to_network: "Base Sepolia",
    to_amount: offer.toAmount,
    premium_pct: offer.premiumPct,
    is_market: false,
    total_amount: offer.fromAmount,
    available_amount: offer.fromAmount,
    filled_amount: 0,
    expected_fill_sec: offer.expectedFillSec ?? null,
    min_order: 0,
    max_order: offer.fromAmount,
    payment_methods: ["onchain"],
    status: "active",
  };
  const result = await createCryptoSwapOffer({
    data: { ...payload, accessToken: await getAccessToken() },
  });
  if (!result.ok) throw new Error(result.error);
}

// Legacy aliases — kept so existing callers keep compiling. Now persist to DB.
export function addSwapRequest(_req: SwapRequest) {
  // no-op: the call site should use saveSwapRequest with userId. Kept for type compat.
}
export function addCryptoSwap(_offer: CryptoSwapOffer) {
  // no-op: same as above.
}
