import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 사용자의 KYC 레벨에 따른 거래 한도 체크.
 * - per_order_krw: 1회 한도
 * - daily_krw: 24시간 누적 한도
 * - monthly_krw: 30일 누적 한도
 * 한도는 app_settings.kyc_limits 에서 관리. 운영자가 콘솔에서 변경 가능.
 */

export type KycLimits = Record<
  string,
  { per_order_krw: number; daily_krw: number; monthly_krw: number; label: string }
>;

export type LimitCheckResult = {
  ok: boolean;
  reason?: string;
  level: number;
  limit: { per_order: number; daily: number; monthly: number; label: string };
  used: { daily: number; monthly: number };
};

export const checkOrderLimit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { fiatAmountKrw: number }) => ({
    fiatAmountKrw: Math.max(0, Number(input.fiatAmountKrw) || 0),
  }))
  .handler(async ({ data, context }): Promise<LimitCheckResult> => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabase.from("profiles").select("kyc_level,is_suspended").eq("id", userId).maybeSingle(),
      supabase.from("app_settings").select("value").eq("key", "kyc_limits").maybeSingle(),
    ]);

    if (profile?.is_suspended) {
      return {
        ok: false,
        reason: "계정이 정지되었습니다. 운영자에게 문의해주세요.",
        level: profile?.kyc_level ?? 0,
        limit: { per_order: 0, daily: 0, monthly: 0, label: "정지" },
        used: { daily: 0, monthly: 0 },
      };
    }

    const level = profile?.kyc_level ?? 0;
    const limits = (settings?.value as KycLimits | undefined) ?? {};
    const tier = limits[String(level)] ??
      limits["0"] ?? {
        per_order_krw: 100000,
        daily_krw: 200000,
        monthly_krw: 500000,
        label: "기본",
      };

    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [{ data: dayVol }, { data: monthVol }] = await Promise.all([
      supabase.rpc("get_user_trade_volume", { _user_id: userId, _since: dayAgo }),
      supabase.rpc("get_user_trade_volume", { _user_id: userId, _since: monthAgo }),
    ]);

    const usedDaily = Number(dayVol ?? 0);
    const usedMonthly = Number(monthVol ?? 0);

    if (data.fiatAmountKrw > tier.per_order_krw) {
      return {
        ok: false,
        reason: `1회 한도(${tier.per_order_krw.toLocaleString()}원)를 초과합니다. 현재 등급: ${tier.label}`,
        level,
        limit: {
          per_order: tier.per_order_krw,
          daily: tier.daily_krw,
          monthly: tier.monthly_krw,
          label: tier.label,
        },
        used: { daily: usedDaily, monthly: usedMonthly },
      };
    }
    if (usedDaily + data.fiatAmountKrw > tier.daily_krw) {
      return {
        ok: false,
        reason: `일일 한도(${tier.daily_krw.toLocaleString()}원)를 초과합니다. 사용: ${usedDaily.toLocaleString()}원`,
        level,
        limit: {
          per_order: tier.per_order_krw,
          daily: tier.daily_krw,
          monthly: tier.monthly_krw,
          label: tier.label,
        },
        used: { daily: usedDaily, monthly: usedMonthly },
      };
    }
    if (usedMonthly + data.fiatAmountKrw > tier.monthly_krw) {
      return {
        ok: false,
        reason: `월간 한도(${tier.monthly_krw.toLocaleString()}원)를 초과합니다. 사용: ${usedMonthly.toLocaleString()}원`,
        level,
        limit: {
          per_order: tier.per_order_krw,
          daily: tier.daily_krw,
          monthly: tier.monthly_krw,
          label: tier.label,
        },
        used: { daily: usedDaily, monthly: usedMonthly },
      };
    }

    return {
      ok: true,
      level,
      limit: {
        per_order: tier.per_order_krw,
        daily: tier.daily_krw,
        monthly: tier.monthly_krw,
        label: tier.label,
      },
      used: { daily: usedDaily, monthly: usedMonthly },
    };
  });
