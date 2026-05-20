import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (!match) continue;
  process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase public env values");

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const stamp = new Date()
  .toISOString()
  .replace(/[-:.TZ]/g, "")
  .slice(0, 14);
const email = `expeer-flow-${stamp}@gmail.com`;
const password = `ExpeerFlow!${stamp}`;
const nickname = `플로우테스트-${stamp}`;

const { data: signUp, error: signUpError } = await supabase.auth.signUp({
  email,
  password,
  options: { data: { nickname }, emailRedirectTo: "http://localhost:8080/app" },
});
if (signUpError) throw signUpError;
if (!signUp.user) throw new Error("signUp did not return a user");
const userId = signUp.user.id;

const { data: bank, error: bankError } = await supabase
  .from("bank_accounts")
  .insert({
    user_id: userId,
    bank_name: "토스뱅크",
    account_number: `1000-${stamp.slice(-4)}-${stamp.slice(4, 8)}`,
    account_holder: nickname,
    is_primary: true,
  })
  .select("id,bank_name,account_number,account_holder,is_primary")
  .single();
if (bankError) throw bankError;

const { data: wallet, error: walletError } = await supabase
  .from("wallets")
  .insert({
    user_id: userId,
    asset: "USDC",
    network: "Base Sepolia",
    address: `0x${stamp.padEnd(40, "0").slice(0, 40)}`,
    label: "테스트 지갑",
    is_primary: true,
  })
  .select("id,asset,network,address,is_primary")
  .single();
if (walletError) throw walletError;

const { data: ad, error: adError } = await supabase
  .from("ads")
  .insert({
    user_id: userId,
    side: "sell",
    asset: "USDC",
    network: "Base Sepolia",
    fiat: "KRW",
    price: 1380,
    total_amount: 1000,
    available_amount: 1000,
    min_order: 100000,
    max_order: 10000000,
    payment_methods: ["bank_transfer"],
    terms: "스모크 테스트 오퍼입니다.",
    status: "active",
  })
  .select("id,side,asset,network,price,total_amount,available_amount,status")
  .single();
if (adError) throw adError;

console.log(
  JSON.stringify(
    {
      flow: "ok",
      user: { id: userId, email, nickname },
      bank,
      wallet,
      ad,
    },
    null,
    2,
  ),
);

await supabase.auth.signOut();
