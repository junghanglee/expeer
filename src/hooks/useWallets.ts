import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type Wallet = Tables<"wallets">;

export function useWallets() {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setWallets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("wallets")
      .select("*")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    setWallets(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (input: Omit<TablesInsert<"wallets">, "user_id">) => {
      if (!user) throw new Error("로그인이 필요합니다");
      const { data, error } = await supabase
        .from("wallets")
        .insert({ ...input, user_id: user.id })
        .select()
        .single();
      if (error) throw error;
      await load();
      return data;
    },
    [user, load],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("wallets").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const setPrimary = useCallback(
    async (id: string, asset: string) => {
      if (!user) return;
      await supabase
        .from("wallets")
        .update({ is_primary: false })
        .eq("user_id", user.id)
        .eq("asset", asset);
      await supabase.from("wallets").update({ is_primary: true }).eq("id", id);
      await load();
    },
    [user, load],
  );

  return { wallets, loading, add, remove, setPrimary, refresh: load };
}
