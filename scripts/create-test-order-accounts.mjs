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

async function signup(role) {
  const stamp = new Date()
    .toISOString()
    .replace(/[-:.TZ]/g, "")
    .slice(0, 14);
  const email = `expeer-${role}-${stamp}@gmail.com`;
  const password = `ExpeerTest!${role}!${stamp}`;
  const nickname = `${role === "buyer" ? "구매자" : "판매자"}테스트-${stamp}`;
  const supabase = client();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nickname }, emailRedirectTo: "http://localhost:8080/app" },
  });
  if (error) throw error;
  if (!data.user) throw new Error(`${role} signUp did not return a user`);
  return { supabase, user: data.user, email, password, nickname, stamp };
}

const seller = await signup("seller");
await new Promise((resolve) => setTimeout(resolve, 600));
const buyer = await signup("buyer");

const { data: sellerBank, error: sellerBankError } = await seller.supabase
  .from("bank_accounts")
  .insert({
    user_id: seller.user.id,
    bank_name: "토스뱅크",
    account_number: `3000-${seller.stamp.slice(-4)}-${seller.stamp.slice(4, 8)}`,
    account_holder: seller.nickname,
    is_primary: true,
  })
  .select("id")
  .single();
if (sellerBankError) throw sellerBankError;

const { data: buyerBank, error: buyerBankError } = await buyer.supabase
  .from("bank_accounts")
  .insert({
    user_id: buyer.user.id,
    bank_name: "KB국민",
    account_number: `4000-${buyer.stamp.slice(-4)}-${buyer.stamp.slice(4, 8)}`,
    account_holder: buyer.nickname,
    is_primary: true,
  })
  .select("id")
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
  .select("id")
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
    terms: "사장님 확인용 테스트 오퍼입니다.",
    status: "active",
  })
  .select("id,user_id,asset,network,fiat,price,available_amount")
  .single();
if (adError) throw adError;

const fiatAmount = 138000;
const amount = fiatAmount / Number(ad.price);
const { data: order, error: orderError } = await buyer.supabase
  .from("orders")
  .insert({
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
    buyer_fee_pct: 1,
    seller_fee_pct: 1,
    buyer_fee_amount: Math.round(fiatAmount * 1) / 100,
    seller_fee_amount: Math.round(fiatAmount * 1) / 100,
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    status: "created",
  })
  .select("id,status,amount,fiat_amount")
  .single();
if (orderError) throw orderError;

const { error: messageError } = await buyer.supabase.from("messages").insert({
  order_id: order.id,
  sender_id: buyer.user.id,
  type: "text",
  content: "테스트 거래방이 생성되었습니다.",
  metadata: { event: "order_created" },
});
if (messageError) throw messageError;

console.log(
  JSON.stringify(
    {
      loginUrl: "http://127.0.0.1:8080/onboarding/login",
      seller: { email: seller.email, password: seller.password, nickname: seller.nickname },
      buyer: { email: buyer.email, password: buyer.password, nickname: buyer.nickname },
      order: {
        id: order.id,
        status: order.status,
        detailUrl: `http://127.0.0.1:8080/app/order/${order.id}`,
        chatUrl: `http://127.0.0.1:8080/app/order/${order.id}/chat`,
      },
    },
    null,
    2,
  ),
);

await buyer.supabase.auth.signOut();
await seller.supabase.auth.signOut();
