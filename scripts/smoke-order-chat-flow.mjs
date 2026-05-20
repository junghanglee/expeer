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

function client() {
  return createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signup(prefix) {
  const stamp = `${prefix}-${new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14)}`;
  const email = `expeer-${stamp}@gmail.com`;
  const password = `ExpeerFlow!${stamp}`;
  const nickname = `테스트-${stamp}`;
  const supabase = client();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname }, emailRedirectTo: "http://localhost:8080/app" },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`${prefix} signUp did not return a user`);
  return { supabase, user: data.user, email, password, nickname, stamp };
}

async function createOrderLikeApp({ buyerSupabase, input }) {
  const fiatAmount = Number(input.fiat_amount);
  const buyerFeePct = 1;
  const sellerFeePct = 1;
  const payload = {
    ...input,
    buyer_fee_pct: buyerFeePct,
    seller_fee_pct: sellerFeePct,
    buyer_fee_amount: Math.round(fiatAmount * buyerFeePct) / 100,
    seller_fee_amount: Math.round(fiatAmount * sellerFeePct) / 100,
  };

  const { data: order, error } = await buyerSupabase
    .from("orders")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;

  const { data: firstMessage, error: messageError } = await buyerSupabase
    .from("messages")
    .insert({
      order_id: order.id,
      sender_id: order.buyer_id,
      type: "text",
      content: "거래방이 생성되었습니다. 상대방 확인 후 안내에 따라 거래를 진행하겠습니다.",
      metadata: { event: "order_created" },
    })
    .select("id,type,content,sender_id,metadata")
    .single();
  if (messageError) throw messageError;

  const { data: ad } = await buyerSupabase
    .from("ads")
    .select("available_amount,total_amount")
    .eq("id", input.ad_id)
    .maybeSingle();
  if (ad) {
    const next = Number(ad.available_amount) - Number(input.amount);
    const { error: updateError } = await buyerSupabase
      .from("ads")
      .update({ available_amount: Math.max(0, next) })
      .eq("id", input.ad_id);
    if (updateError) throw updateError;
  }

  return { order, firstMessage };
}

const seller = await signup("seller-ui");
const buyer = await signup("buyer-ui");

const { data: sellerBank, error: sellerBankError } = await seller.supabase
  .from("bank_accounts")
  .insert({
    user_id: seller.user.id,
    bank_name: "토스뱅크",
    account_number: `3000-${seller.stamp.slice(-4)}-${seller.stamp.slice(7, 11)}`,
    account_holder: seller.nickname,
    is_primary: true,
  })
  .select("id,bank_name,account_number,account_holder,is_primary")
  .single();
if (sellerBankError) throw sellerBankError;

const { data: buyerBank, error: buyerBankError } = await buyer.supabase
  .from("bank_accounts")
  .insert({
    user_id: buyer.user.id,
    bank_name: "KB국민",
    account_number: `4000-${buyer.stamp.slice(-4)}-${buyer.stamp.slice(7, 11)}`,
    account_holder: buyer.nickname,
    is_primary: true,
  })
  .select("id,bank_name,account_number,account_holder,is_primary")
  .single();
if (buyerBankError) throw buyerBankError;

const { data: buyerWallet, error: buyerWalletError } = await buyer.supabase
  .from("wallets")
  .insert({
    user_id: buyer.user.id,
    asset: "USDC",
    network: "Base Sepolia",
    address: `0x${buyer.stamp.replace(/-/g, "").padEnd(40, "2").slice(0, 40)}`,
    label: "구매자 테스트 지갑",
    is_primary: true,
  })
  .select("id,asset,network,address,is_primary")
  .single();
if (buyerWalletError) throw buyerWalletError;

const { data: ad, error: adError } = await seller.supabase
  .from("ads")
  .insert({
    user_id: seller.user.id,
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
    terms: "UI 주문 생성 스모크 테스트 오퍼입니다.",
    status: "active",
  })
  .select("id,user_id,side,asset,network,fiat,price,available_amount")
  .single();
if (adError) throw adError;

const fiatAmount = 138000;
const amount = fiatAmount / Number(ad.price);
const { order, firstMessage } = await createOrderLikeApp({
  buyerSupabase: buyer.supabase,
  input: {
    ad_id: ad.id,
    buyer_id: buyer.user.id,
    seller_id: seller.user.id,
    asset: ad.asset,
    network: ad.network,
    chain: "base-sepolia",
    fiat: ad.fiat ?? "KRW",
    price: ad.price,
    amount,
    fiat_amount: fiatAmount,
    buyer_bank_account_id: buyerBank.id,
    seller_bank_account_id: sellerBank.id,
    buyer_wallet_id: buyerWallet.id,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    status: "created",
  },
});

const { data: buyerMessages, error: buyerMessageReadError } = await buyer.supabase
  .from("messages")
  .select("id,type,content,sender_id,metadata")
  .eq("order_id", order.id)
  .order("created_at");
if (buyerMessageReadError) throw buyerMessageReadError;

const { data: sellerMessages, error: sellerMessageReadError } = await seller.supabase
  .from("messages")
  .select("id,type,content,sender_id,metadata")
  .eq("order_id", order.id)
  .order("created_at");
if (sellerMessageReadError) throw sellerMessageReadError;

const { data: updatedAd, error: updatedAdError } = await buyer.supabase
  .from("ads")
  .select("available_amount")
  .eq("id", ad.id)
  .single();
if (updatedAdError) throw updatedAdError;

console.log(
  JSON.stringify(
    {
      flow: "ok",
      ad: {
        id: ad.id,
        beforeAvailable: Number(ad.available_amount),
        afterAvailable: Number(updatedAd.available_amount),
      },
      order: {
        id: order.id,
        status: order.status,
        amount: Number(order.amount),
        fiat_amount: Number(order.fiat_amount),
      },
      firstMessage,
      buyerCanReadMessages: buyerMessages?.length ?? 0,
      sellerCanReadMessages: sellerMessages?.length ?? 0,
      nextUiRoute: `/app/order/${order.id}/chat`,
    },
    null,
    2,
  ),
);

await buyer.supabase.auth.signOut();
await seller.supabase.auth.signOut();
