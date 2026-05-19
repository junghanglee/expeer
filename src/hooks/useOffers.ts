import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables, TablesInsert, Enums } from "@/integrations/supabase/types";

export type Offer = Tables<"ads">;
export type OfferSide = Enums<"ad_side">;

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
