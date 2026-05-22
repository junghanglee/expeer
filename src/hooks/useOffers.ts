import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables, TablesInsert, Enums } from "@/integrations/supabase/types";

export type Offer = Tables<"ads">;
export type OfferSide = Enums<"ad_side">;

function demoOffer(id: string): Offer | null {
  const map: Record<string, Partial<Offer>> = {
    "demo-sell-usdt-1": {
      side: "sell",
      asset: "USDT",
      fiat: "KRW",
      price: 1376,
      total_amount: 3200,
      available_amount: 2750,
      min_order: 100000,
      max_order: 5000000,
      terms: "입금자명과 주문금액이 일치해야 승인합니다. 거래방 밖 연락은 받지 않습니다.",
      user_id: "demo-merchant-sell-1",
    },
    "demo-sell-usdt-2": {
      side: "sell",
      asset: "USDT",
      fiat: "KRW",
      price: 1382,
      total_amount: 1800,
      available_amount: 1800,
      min_order: 50000,
      max_order: 2500000,
      terms: "무통장입금 확인 후 빠르게 릴리즈합니다.",
      user_id: "demo-merchant-sell-2",
    },
    "demo-buy-usdt-1": {
      side: "buy",
      asset: "USDT",
      fiat: "KRW",
      price: 1371,
      total_amount: 2500,
      available_amount: 2200,
      min_order: 100000,
      max_order: 4000000,
      terms: "송금 전 거래방 안내를 확인해 주세요. 증빙자료는 자동 보관됩니다.",
      user_id: "demo-merchant-buy-1",
    },
    "demo-sell-usdc-1": {
      side: "sell",
      asset: "USDC",
      fiat: "KRW",
      price: 1378,
      total_amount: 1500,
      available_amount: 1380,
      min_order: 70000,
      max_order: 2000000,
      terms: "USDC Base Sepolia 기준 테스트 오퍼입니다.",
      user_id: "demo-merchant-usdc-1",
    },
  };
  const item = map[id];
  if (!item) return null;
  const now = new Date().toISOString();
  return {
    id,
    asset: item.asset ?? "USDT",
    available_amount: item.available_amount ?? 1000,
    created_at: now,
    expected_fill_sec: 90,
    fiat: item.fiat ?? "KRW",
    filled_amount: 0,
    is_market: false,
    kind: "fiat",
    max_order: item.max_order ?? 5000000,
    min_order: item.min_order ?? 100000,
    network: "Base Sepolia",
    payment_methods: ["bank_transfer"],
    premium_pct: null,
    price: item.price ?? 1380,
    side: item.side ?? "sell",
    status: "active",
    terms: item.terms ?? null,
    to_amount: null,
    to_asset: null,
    to_network: null,
    total_amount: item.total_amount ?? 1000,
    updated_at: now,
    user_id: item.user_id ?? "demo-merchant",
  } as Offer;
}

export interface OfferFilters {
  side?: OfferSide;
  asset?: string;
  fiat?: string;
  mineOnly?: boolean;
}

export function useOffers(filters: OfferFilters = {}) {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("ads").select("*").order("created_at", { ascending: false });
    if (filters.mineOnly && user) q = q.eq("user_id", user.id);
    else q = q.eq("status", "active");
    if (filters.side) q = q.eq("side", filters.side);
    if (filters.asset) q = q.eq("asset", filters.asset);
    if (filters.fiat) q = q.eq("fiat", filters.fiat);
    const { data } = await q;
    setOffers(data ?? []);
    setLoading(false);
  }, [user, filters.side, filters.asset, filters.fiat, filters.mineOnly]);

  useEffect(() => {
    load();
  }, [load]);

  return { offers, loading, refresh: load };
}

export function useOffer(id: string | undefined) {
  const [offer, setOffer] = useState<Offer | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setOffer(null);
      setLoading(false);
      return;
    }
    if (id.startsWith("demo-")) {
      setOffer(demoOffer(id));
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("ads").select("*").eq("id", id).maybeSingle();
    setOffer(data ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { offer, loading, refresh: load };
}

export async function createOffer(
  user_id: string,
  input: Omit<TablesInsert<"ads">, "user_id" | "available_amount"> & { available_amount?: number },
) {
  const payload: TablesInsert<"ads"> = {
    ...input,
    user_id,
    available_amount: input.available_amount ?? input.total_amount,
  };
  const { data, error } = await supabase.from("ads").insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateOfferStatus(id: string, status: Enums<"ad_status">) {
  const { error } = await supabase.from("ads").update({ status }).eq("id", id);
  if (error) throw error;
}

export async function deleteOffer(id: string) {
  const { error } = await supabase.from("ads").delete().eq("id", id);
  if (error) throw error;
}
