import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type AdminKpi = {
  todayOrders: number;
  todayVolumeKrw: number;
  openDisputes: number;
  suspendedUsers: number;
  pendingKyc: number;
};

export function useAdminKpi() {
  return useQuery<AdminKpi>({
    queryKey: ["admin", "kpi"],
    queryFn: async () => {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const isoStart = startOfDay.toISOString();

      const [todayOrders, todayVolume, openDisputes, suspended, pendingKyc] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .gte("created_at", isoStart),
        supabase.from("orders").select("fiat_amount").gte("created_at", isoStart).eq("fiat", "KRW"),
        supabase.from("disputes").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("is_suspended", true),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("kyc_status", "pending"),
      ]);

      const volume = (todayVolume.data ?? []).reduce(
        (sum, r) => sum + Number(r.fiat_amount ?? 0),
        0,
      );

      return {
        todayOrders: todayOrders.count ?? 0,
        todayVolumeKrw: volume,
        openDisputes: openDisputes.count ?? 0,
        suspendedUsers: suspended.count ?? 0,
        pendingKyc: pendingKyc.count ?? 0,
      };
    },
    staleTime: 30_000,
  });
}

export type RecentDispute = Tables<"disputes"> & {
  order?: Pick<Tables<"orders">, "asset" | "fiat_amount"> | null;
};

export function useRecentDisputes(limit = 5) {
  return useQuery<RecentDispute[]>({
    queryKey: ["admin", "recent-disputes", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as RecentDispute[];
    },
    staleTime: 30_000,
  });
}

export type RecentOrder = Tables<"orders">;

export function useRecentOrders(limit = 5) {
  return useQuery<RecentOrder[]>({
    queryKey: ["admin", "recent-orders", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });
}
