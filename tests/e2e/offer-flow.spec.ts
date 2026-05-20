import { test, expect } from "@playwright/test";
import { loadEnv } from "./helpers.mjs";
import {
  createBankAccount,
  createSellOffer,
  createWallet,
  signupUser,
} from "./helpers.mjs";

loadEnv();

async function login(page, user) {
  await page.addInitScript(
    ({ supabaseUrl, supabaseKey, session }) => {
      const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: Math.floor(Date.now() / 1000) + 60 * 60,
          expires_in: 60 * 60,
          token_type: "bearer",
          user: session.user,
        }),
      );
      window.localStorage.setItem("expeer.login.email", session.user.email ?? "");
    },
    {
      supabaseUrl: process.env.VITE_SUPABASE_URL,
      supabaseKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      session: {
        access_token: user.session.access_token,
        refresh_token: user.session.refresh_token,
        user: user.session.user,
      },
    },
  );
  await page.goto("/app");
  await expect(page).toHaveURL(/\/app/);
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
}

async function logout(page) {
  await page.context().clearCookies();
  await page.goto("/onboarding/login");
  await page.evaluate(() => localStorage.clear());
}

test("seller can log in, register a Supabase-backed offer, and see it in market", async ({ page }) => {
  const seller = await signupUser("seller-pw");
  await createBankAccount(seller.supabase, seller.user.id, seller.nickname, seller.stamp);
  await createWallet(seller.supabase, seller.user.id, seller.stamp, "USDC", "Base Sepolia");

  await login(page, seller);

  await page.goto("/app/selling/new");
  await expect(page.getByText("오퍼 등록").first()).toBeVisible();
  await expect(page.getByText("USDC 테스트 지갑 확인됨")).toBeVisible();
  await page.getByRole("button", { name: /판매 오퍼 등록하기/ }).click();

  await expect(page).toHaveURL(/\/app\/ads\/[0-9a-f-]+/);
  const adUrl = page.url();
  const adId = adUrl.split("/app/ads/")[1];
  expect(adId).toBeTruthy();

  const { data: ad, error } = await seller.supabase
    .from("ads")
    .select("id,user_id,side,asset,network,price,total_amount,status")
    .eq("id", adId)
    .single();
  expect(error).toBeNull();
  expect(ad).toMatchObject({
    user_id: seller.user.id,
    side: "sell",
    asset: "USDC",
    network: "Base Sepolia",
    status: "active",
  });

  await page.goto("/app/market");
  await page.getByRole("button", { name: /코인 USDT/ }).click();
  await page.getByRole("button", { name: /USDC/ }).click();
  await expect(page.getByText("USDC 판매중").first()).toBeVisible();
  await expect(page.getByText("1,380").first()).toBeVisible();
});

test("buyer can open market offer and create order chat", async ({ page }) => {
  const seller = await signupUser("seller-order-pw");
  const buyer = await signupUser("buyer-order-pw");
  const sellerBank = await createBankAccount(
    seller.supabase,
    seller.user.id,
    seller.nickname,
    seller.stamp,
    "토스뱅크",
  );
  const buyerBank = await createBankAccount(
    buyer.supabase,
    buyer.user.id,
    buyer.nickname,
    buyer.stamp,
    "KB국민",
  );
  const buyerWallet = await createWallet(
    buyer.supabase,
    buyer.user.id,
    buyer.stamp,
    "USDC",
    "Base Sepolia",
  );
  const ad = await createSellOffer(seller.supabase, seller.user.id);

  await login(page, buyer);

  await page.goto(`/app/order/new/${ad.id}`);
  await expect(page.getByText("주문 생성").first()).toBeVisible();
  await page.getByPlaceholder("0").fill("138000");
  await expect(page.getByText("받을 코인").locator("..").getByText("100 USDC")).toBeVisible();
  await page.getByRole("button", { name: /KB국민/ }).click();
  await page.getByRole("button", { name: /USDC 테스트 지갑/ }).click();
  await expect(page.getByRole("button", { name: /^주문 생성$/ })).toBeEnabled();
  const submitButton = page.getByRole("button", { name: /^주문 생성$/ });
  await submitButton.click();

  await expect(page).toHaveURL(/\/app\/order\/[0-9a-f-]+\/chat/);
  const orderId = page.url().match(/\/app\/order\/([^/]+)\/chat/)?.[1];
  expect(orderId).toBeTruthy();

  const { data: order, error: orderError } = await buyer.supabase
    .from("orders")
    .select("id,ad_id,buyer_id,seller_id,buyer_bank_account_id,seller_bank_account_id,buyer_wallet_id,status")
    .eq("id", orderId)
    .single();
  expect(orderError).toBeNull();
  expect(order).toMatchObject({
    ad_id: ad.id,
    buyer_id: buyer.user.id,
    seller_id: seller.user.id,
    buyer_bank_account_id: buyerBank.id,
    seller_bank_account_id: sellerBank.id,
    buyer_wallet_id: buyerWallet.id,
    status: "created",
  });

  const { data: messages, error: messageError } = await buyer.supabase
    .from("messages")
    .select("id,content,metadata")
    .eq("order_id", orderId);
  expect(messageError).toBeNull();
  expect(messages?.some((m) => m.metadata?.event === "order_created")).toBe(true);
  await expect(page.getByText("거래방이 생성되었습니다")).toBeVisible();

  await page.goto(`/app/order/${orderId}`);
  await expect(page.getByText("이 계좌로 송금해 주세요")).toBeVisible();
  await expect(
    page.getByText(/토스뱅크|판매자 계좌 조회 RPC가 아직 Supabase에 적용되지 않았어요/),
  ).toBeVisible();
});

test("buyer payment and seller completion update order activity", async ({ page }) => {
  const seller = await signupUser("seller-complete-pw");
  const buyer = await signupUser("buyer-complete-pw");
  const sellerBank = await createBankAccount(
    seller.supabase,
    seller.user.id,
    seller.nickname,
    seller.stamp,
    "토스뱅크",
  );
  const buyerBank = await createBankAccount(
    buyer.supabase,
    buyer.user.id,
    buyer.nickname,
    buyer.stamp,
    "KB국민",
  );
  const buyerWallet = await createWallet(
    buyer.supabase,
    buyer.user.id,
    buyer.stamp,
    "USDC",
    "Base Sepolia",
  );
  const ad = await createSellOffer(seller.supabase, seller.user.id);

  const { data: order, error: orderError } = await buyer.supabase
    .from("orders")
    .insert({
      ad_id: ad.id,
      buyer_id: buyer.user.id,
      seller_id: seller.user.id,
      asset: "USDC",
      network: "Base Sepolia",
      fiat: "KRW",
      price: 1380,
      amount: 100,
      fiat_amount: 138000,
      buyer_bank_account_id: buyerBank.id,
      seller_bank_account_id: sellerBank.id,
      buyer_wallet_id: buyerWallet.id,
      status: "created",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    })
    .select("id,status")
    .single();
  expect(orderError).toBeNull();
  expect(order?.id).toBeTruthy();

  await login(page, buyer);
  await page.goto(`/app/order/${order.id}`);
  await expect(page.getByText("지금 해야 할 일: 입금하기")).toBeVisible();
  await page.getByRole("button", { name: "입금 완료 표시" }).click();
  await expect(page.getByText("판매자가 입금을 확인 중이에요")).toBeVisible();

  const { data: paidOrder, error: paidError } = await buyer.supabase
    .from("orders")
    .select("status,paid_at")
    .eq("id", order.id)
    .single();
  expect(paidError).toBeNull();
  expect(paidOrder?.status).toBe("paid");
  expect(paidOrder?.paid_at).toBeTruthy();

  await logout(page);
  await login(page, seller);
  await page.goto(`/app/order/${order.id}/chat`);
  await expect(page.getByText("입금을 확인 후 코인을 릴리즈해 주세요.")).toBeVisible();
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: /입금 확인 \+ 코인 릴리즈/ }).click();
  await expect(page.getByText("거래 완료", { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const { data, error } = await seller.supabase
        .from("orders")
        .select("status,released_at,completed_at")
        .eq("id", order.id)
        .single();
      if (error) throw error;
      return data;
    })
    .toMatchObject({ status: "completed" });
  await page.reload();
  await expect(page.getByText("거래가 완료되었습니다").first()).toBeVisible();

  const { data: completedOrder, error: completedError } = await seller.supabase
    .from("orders")
    .select("status,released_at,completed_at")
    .eq("id", order.id)
    .single();
  expect(completedError).toBeNull();
  expect(completedOrder?.status).toBe("completed");
  expect(completedOrder?.released_at).toBeTruthy();
  expect(completedOrder?.completed_at).toBeTruthy();

  await page.goto("/app/selling");
  await page.getByRole("button", { name: /완료된 거래/ }).click();
  await expect(page.getByText(`주문 #${order.id.slice(-6)}`)).toBeVisible();
  await expect(page.getByText("완료").first()).toBeVisible();
});
