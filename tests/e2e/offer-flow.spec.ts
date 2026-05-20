import { test, expect } from "@playwright/test";
import {
  createBankAccount,
  createSellOffer,
  createWallet,
  signupUser,
} from "./helpers.mjs";

test("seller can log in, register a Supabase-backed offer, and see it in market", async ({ page }) => {
  const seller = await signupUser("seller-pw");
  await createBankAccount(seller.supabase, seller.user.id, seller.nickname, seller.stamp);
  await createWallet(seller.supabase, seller.user.id, seller.stamp, "USDC", "Base Sepolia");

  await page.goto("/onboarding/login");
  await page.getByPlaceholder("you@example.com").fill(seller.email);
  await page.getByPlaceholder("비밀번호").fill(seller.password);
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/app/);

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

  await page.goto("/onboarding/login");
  await page.getByPlaceholder("you@example.com").fill(buyer.email);
  await page.getByPlaceholder("비밀번호").fill(buyer.password);
  await page.getByRole("button", { name: "로그인" }).click();
  await expect(page).toHaveURL(/\/app/);

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
});
