import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SupabaseLike = SupabaseClient<Database>;

async function assertAdmin(supabase: SupabaseLike, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("관리자 권한이 필요합니다");
}

export const adminToggleSuspend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ userId: z.string().uuid(), suspended: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ is_suspended: data.suspended })
      .eq("id", data.userId)
      .select("id")
      .maybeSingle();
    if (updateError) return { ok: false, error: updateError.message };
    if (!updatedProfile) return { ok: false, error: "정지/활성화할 사용자를 찾을 수 없습니다" };
    return { ok: true };
  });

export const adminDecideKyc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        submissionId: z.string().uuid(),
        userId: z.string().uuid(),
        status: z.enum(["approved", "rejected"]),
        note: z.string().max(2000).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);

    const { error: e1 } = await supabase
      .from("kyc_submissions")
      .update({
        status: data.status,
        reviewer_note: data.note?.trim() || null,
        reviewer_id: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.submissionId);
    if (e1) return { ok: false, error: e1.message };

    const { error: e2 } = await supabase
      .from("profiles")
      .update({
        kyc_status: data.status,
        kyc_level: data.status === "approved" ? 1 : 0,
      })
      .eq("id", data.userId);
    if (e2) return { ok: false, error: e2.message };

    await supabase.from("notifications").insert({
      user_id: data.userId,
      type: "kyc",
      title: data.status === "approved" ? "KYC 승인 완료" : "KYC 반려",
      body:
        data.status === "approved"
          ? "본인인증이 완료되었습니다"
          : data.note || "검토 후 다시 제출해 주세요",
    });

    return { ok: true };
  });

export const adminSaveFees = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        buyer_pct: z.number().min(0).max(20),
        seller_pct: z.number().min(0).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "fees", value: data, updated_by: userId });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

/**
 * Escrow 컨트랙트 주소 등록.
 * 체인 키별로 배포된 ExpeerEscrowVaultV2 주소를 app_settings.escrow_contracts 에 저장.
 * 인덱서/지갑 hook은 이 값을 source of truth 로 사용한다.
 */
export const adminSaveEscrowContracts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        base: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .nullable()
          .optional(),
        "base-sepolia": z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .nullable()
          .optional(),
        polygon: z
          .string()
          .regex(/^0x[a-fA-F0-9]{40}$/)
          .nullable()
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { data: existing } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "escrow_contracts")
      .maybeSingle();
    const merged = { ...((existing?.value as Record<string, unknown>) ?? {}), ...data };
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "escrow_contracts", value: merged, updated_by: userId });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
