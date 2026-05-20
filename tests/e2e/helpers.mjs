import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

export function loadEnv() {
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (!match) continue;
    process.env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, "");
  }
}

export function makeSupabaseClient() {
  loadEnv();
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase public env values");
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: false },
  });
}

export function makeStamp(prefix = "e2e") {
  return `${prefix}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
}

export async function signupUser(prefix) {
  const supabase = makeSupabaseClient();
  const stamp = makeStamp(prefix);
  const email = `expeer-${stamp}@gmail.com`;
  const password = `ExpeerUi!${stamp}`;
  const nickname = `UI테스트-${stamp}`;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname }, emailRedirectTo: "http://localhost:8080/app" },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`${prefix} signUp did not return a user`);

  if (!data.session) {
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ kyc_status: "approved", kyc_level: 2 })
    .eq("id", data.user.id);
  if (profileError) throw profileError;

  return { supabase, user: data.user, email, password, nickname, stamp };
}

export async function createBankAccount(supabase, userId, nickname, stamp, bankName = "토스뱅크") {
  const { data, error } = await supabase
    .from("bank_accounts")
    .insert({
      user_id: userId,
      bank_name: bankName,
      account_number: `9000-${stamp.slice(-4)}-${stamp.slice(4, 8)}`,
      account_holder: nickname,
      is_primary: true,
    })
    .select("id,bank_name,account_number,account_holder,is_primary")
    .single();
  if (error) throw error;
  return data;
}

export async function createWallet(supabase, userId, stamp, asset = "USDC", network = "Base Sepolia") {
  const { data, error } = await supabase
    .from("wallets")
    .insert({
      user_id: userId,
      asset,
      network,
      address: `0x${stamp.replace(/-/g, "").padEnd(40, "7").slice(0, 40)}`,
      label: `${asset} 테스트 지갑`,
      is_primary: true,
    })
    .select("id,asset,network,address,is_primary")
    .single();
  if (error) throw error;
  return data;
}

export async function createSellOffer(supabase, sellerId, overrides = {}) {
  const { data, error } = await supabase
    .from("ads")
    .insert({
      user_id: sellerId,
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
      terms: "Playwright UI 스모크 테스트 오퍼입니다.",
      status: "active",
      ...overrides,
    })
    .select("id,user_id,side,asset,network,fiat,price,available_amount")
    .single();
  if (error) throw error;
  return data;
}
