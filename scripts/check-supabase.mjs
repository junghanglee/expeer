import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey)
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY");

const supabase = createClient(supabaseUrl, supabaseKey);

const checks = [
  ["profiles", supabase.from("profiles").select("id,email,nickname").limit(1)],
  ["ads", supabase.from("ads").select("id,asset,fiat,status").limit(1)],
  ["orders", supabase.from("orders").select("id,status").limit(1)],
  ["messages", supabase.from("messages").select("id,order_id").limit(1)],
  ["bank_accounts", supabase.from("bank_accounts").select("id,bank_name").limit(1)],
  ["wallets", supabase.from("wallets").select("id,asset,network").limit(1)],
  ["app_settings", supabase.from("app_settings").select("key,value").limit(1)],
];

for (const [name, promise] of checks) {
  const res = await promise;
  console.log(
    name,
    JSON.stringify(
      { ok: !res.error, count: res.data?.length ?? 0, error: res.error?.message },
      null,
      2,
    ),
  );
}
