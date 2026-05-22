import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
type SupabaseLike = SupabaseClient<Database>;
type TradeApprovalContext = {
  supabase: SupabaseLike;
  userId: string;
};

export const checkTradeApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { counterpartyId?: string | null }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as TradeApprovalContext;
    const ids = Array.from(new Set([userId, data.counterpartyId].filter(Boolean))) as string[];

    const rows = await Promise.all(
      ids.map(async (id) => {
        const { data: status, error: statusError } = await supabase.rpc(
          "get_trade_approval_status",
          {
            _user_id: id,
          },
        );
        if (statusError) throw new Error(statusError.message);
        return { id, approval: status?.[0] };
      }),
    );

    const missingStatus = rows.find((row) => !row.approval);
    if (missingStatus) {
      return {
        ok: false,
        code:
          missingStatus.id === userId
            ? "self_approval_unavailable"
            : "counterparty_approval_unavailable",
        message:
          missingStatus.id === userId
            ? "거래 승인 정보를 확인할 수 없습니다. 실명 인증 정보를 먼저 확인해 주세요."
            : "거래상대의 승인 정보를 확인할 수 없어 주문을 생성할 수 없습니다.",
      };
    }

    const rejected = rows.find((row) => row.approval && !row.approval.ok);
    if (rejected?.approval) {
      const isSelf = rejected.id === userId;
      const reasonMap: Record<string, { self: string; counterparty: string }> = {
        phone_required: {
          self: "거래 전 휴대폰 번호 등록이 필요합니다. 실명 인증에서 번호를 먼저 입력해 주세요.",
          counterparty: "거래상대의 휴대폰 번호가 아직 등록되지 않아 주문을 생성할 수 없습니다.",
        },
        phone_blacklisted: {
          self: "현재 휴대폰 번호가 거래 제한 목록에 있어 주문을 생성할 수 없습니다. 고객지원에 문의해 주세요.",
          counterparty: "거래상대가 거래 제한 목록에 있어 주문을 생성할 수 없습니다.",
        },
        account_blocked: {
          self: "현재 계정은 거래 승인 대상이 아닙니다. 고객지원에 문의해 주세요.",
          counterparty: "거래상대가 승인 제한 대상이어서 주문을 생성할 수 없습니다.",
        },
      };
      const messages = reasonMap[rejected.approval.code] ?? reasonMap.account_blocked;
      return {
        ok: false,
        code: `${isSelf ? "self" : "counterparty"}_${rejected.approval.code}`,
        message: isSelf ? messages.self : messages.counterparty,
      };
    }

    const self = rows.find((row) => row.id === userId)?.approval;
    const counterparty = rows.find((row) => row.id === data.counterpartyId)?.approval;

    return {
      ok: true,
      code: "approved",
      message: "휴대폰 번호 기준 거래 승인 확인 완료",
      selfPhoneLast4: self?.phone_last4 ?? null,
      counterpartyPhoneLast4: counterparty?.phone_last4 ?? null,
    };
  });
