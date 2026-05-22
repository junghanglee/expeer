import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "./helpers.mjs";

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase public env vars for admin flow tests");
}

const adminEmail = "admin@expeer.kr";
const adminPassword = process.env.EXPEER_ADMIN_PASSWORD || "qlalfqjsgh23@#";
const testSource = "playwright_admin_test";

test.afterEach(async () => {
  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword,
  });
  if (loginError) return;
  await supabase.from("phone_blacklist_entries").delete().eq("source", testSource);
});

test("admin can log in and manage phone blacklist", async ({ page }) => {
  await page.goto("/expeeradmin");

  await expect(page.getByRole("heading", { name: "운영자 로그인" })).toBeVisible();
  await expect(page.getByPlaceholder("관리자 이메일")).toHaveValue(adminEmail);

  await page.getByPlaceholder("비밀번호").fill(adminPassword);
  await page.getByRole("button", { name: "로그인" }).click();

  await expect(page).toHaveURL(/\/expeeradmin\/dashboard/);

  await page.goto("/expeeradmin/users");
  await expect(page.getByText("휴대폰 블랙리스트")).toBeVisible();
  await expect(page.getByText("관리자 전용")).toBeVisible();

  await page.getByPlaceholder("휴대폰 번호").fill("010-7777-4321");
  await page.getByPlaceholder("등록 사유").fill("Playwright 관리자 검증");
  await page.getByPlaceholder("출처 예: manual / haja2").fill(testSource);
  await page.getByRole("button", { name: /등록/ }).click();

  await expect(page.getByText("****4321")).toBeVisible();
  await expect(page.getByText(new RegExp(`Playwright 관리자 검증 · ${testSource}`))).toBeVisible();

  await page.getByRole("button", { name: /해제/ }).first().click();
  await expect(page.getByText("블랙리스트 해제 완료")).toBeVisible();
});
