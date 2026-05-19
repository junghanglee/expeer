import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface FeeSettings {
  buyer_pct: number;
  seller_pct: number;
}

export const DEFAULT_FEES: FeeSettings = { buyer_pct: 1, seller_pct: 1 };

export function useFeeSettings() {
  const [fees, setFees] = useState<FeeSettings>(DEFAULT_FEES);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "fees")
      .maybeSingle();
    if (data?.value) {
      const v = data.value as Partial<FeeSettings>;
      setFees({
        buyer_pct: Number(v.buyer_pct ?? DEFAULT_FEES.buyer_pct),
        seller_pct: Number(v.seller_pct ?? DEFAULT_FEES.seller_pct),
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { fees, loading, refresh: load };
}

export async function getFeeSettings(): Promise<FeeSettings> {
  const { data } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "fees")
    .maybeSingle();
  if (!data?.value) return DEFAULT_FEES;
  const v = data.value as Partial<FeeSettings>;
  return {
    buyer_pct: Number(v.buyer_pct ?? DEFAULT_FEES.buyer_pct),
    seller_pct: Number(v.seller_pct ?? DEFAULT_FEES.seller_pct),
  };
}

export async function saveFeeSettings(fees: FeeSettings): Promise<void> {
  const { adminSaveFees } = await import("@/utils/admin.functions");
  const res = await adminSaveFees({ data: fees });
  if (!res.ok) throw new Error(res.error ?? "수수료 저장 실패");
}
