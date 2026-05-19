import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";

export type BankAccount = Tables<"bank_accounts">;

export function useBankAccounts() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("bank_accounts")
      .select("*")
      .eq("user_id", user.id)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });
    setAccounts(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const add = useCallback(
    async (input: Omit<TablesInsert<"bank_accounts">, "user_id">) => {
      if (!user) throw new Error("로그인이 필요합니다");
      const { data, error } = await supabase
        .from("bank_accounts")
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
      const { error } = await supabase.from("bank_accounts").delete().eq("id", id);
      if (error) throw error;
      await load();
    },
    [load],
  );

  const setPrimary = useCallback(
    async (id: string) => {
      if (!user) return;
      await supabase.from("bank_accounts").update({ is_primary: false }).eq("user_id", user.id);
      await supabase.from("bank_accounts").update({ is_primary: true }).eq("id", id);
      await load();
    },
    [user, load],
  );

  return { accounts, loading, add, remove, setPrimary, refresh: load };
}
