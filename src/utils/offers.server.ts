import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { TablesInsert } from "@/integrations/supabase/types";

export async function insertOfferForUser(
  userId: string,
  input: Omit<TablesInsert<"ads">, "user_id">,
) {
  const payload: TablesInsert<"ads"> = {
    ...input,
    user_id: userId,
  };

  const { data, error } = await supabaseAdmin.from("ads").insert(payload).select().single();

  if (error) throw new Error(error.message);
  return data;
}
