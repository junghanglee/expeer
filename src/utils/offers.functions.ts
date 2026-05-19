import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { insertOfferForUser } from "./offers.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function getUserIdFromToken(accessToken: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data.user) throw new Error("로그인 세션이 만료되었습니다. 다시 로그인해 주세요.");
  return data.user.id;
}

const fiatOfferSchema = z.object({
  accessToken: z.string().min(1),
  side: z.enum(["buy", "sell"]),
  asset: z.string().min(1),
  fiat: z.string().min(1),
  network: z.string().min(1),
  price: z.number().finite().nonnegative(),
  is_market: z.boolean(),
  total_amount: z.number().finite().positive(),
  available_amount: z.number().finite().positive(),
  filled_amount: z.number().finite().nonnegative(),
  expected_fill_sec: z.number().int().positive().nullable(),
  min_order: z.number().finite().nonnegative(),
  max_order: z.number().finite().nonnegative(),
  payment_methods: z.array(z.string().min(1)).min(1),
  status: z.literal("active"),
});

const cryptoSwapOfferSchema = z.object({
  accessToken: z.string().min(1),
  side: z.literal("sell"),
  asset: z.string().min(1),
  network: z.string().min(1),
  fiat: z.null(),
  price: z.number().finite().nonnegative(),
  to_asset: z.string().min(1),
  to_network: z.string().min(1),
  to_amount: z.number().finite().positive(),
  premium_pct: z.number().finite(),
  is_market: z.literal(false),
  total_amount: z.number().finite().positive(),
  available_amount: z.number().finite().positive(),
  filled_amount: z.number().finite().nonnegative(),
  expected_fill_sec: z.number().int().positive().nullable(),
  min_order: z.number().finite().nonnegative(),
  max_order: z.number().finite().nonnegative(),
  payment_methods: z.array(z.string().min(1)).min(1),
  status: z.literal("active"),
});

export const createFiatOffer = createServerFn({ method: "POST" })
  .inputValidator((input) => fiatOfferSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { accessToken, ...offerInput } = data;
      const userId = await getUserIdFromToken(accessToken);
      const offer = await insertOfferForUser(userId, { ...offerInput, kind: "fiat" });
      return { ok: true as const, offer };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "등록 실패" };
    }
  });

export const createCryptoSwapOffer = createServerFn({ method: "POST" })
  .inputValidator((input) => cryptoSwapOfferSchema.parse(input))
  .handler(async ({ data }) => {
    try {
      const { accessToken, ...offerInput } = data;
      const userId = await getUserIdFromToken(accessToken);
      const offer = await insertOfferForUser(userId, { ...offerInput, kind: "crypto_swap" });
      return { ok: true as const, offer };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : "등록 실패" };
    }
  });
