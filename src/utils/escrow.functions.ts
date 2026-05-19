import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 에스크로 트랜잭션이 발생하면 DB에 결과를 기록한다.
 * - 클라이언트에서 viem으로 트랜잭션을 보낸 후 호출
 */

export const recordEscrowLock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { orderId: string; chain: string; escrowAddress: string; lockTxHash: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // 본인이 판매자인지 확인
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, seller_id, escrow_status")
      .eq("id", data.orderId)
      .single();
    if (orderErr || !order) return { ok: false, error: "주문을 찾을 수 없습니다" };
    if (order.seller_id !== userId) return { ok: false, error: "판매자만 락업할 수 있습니다" };

    const { error } = await supabase
      .from("orders")
      .update({
        chain: data.chain,
        escrow_contract_address: data.escrowAddress,
        escrow_lock_tx_hash: data.lockTxHash,
        escrow_status: "locked",
      })
      .eq("id", data.orderId);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const recordEscrowRelease = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; releaseTxHash: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: order } = await supabase
      .from("orders")
      .select("id, seller_id, buyer_id")
      .eq("id", data.orderId)
      .single();
    if (!order) return { ok: false, error: "주문을 찾을 수 없습니다" };
    if (order.seller_id !== userId) return { ok: false, error: "판매자만 릴리즈할 수 있습니다" };

    const { error } = await supabase
      .from("orders")
      .update({
        escrow_release_tx_hash: data.releaseTxHash,
        escrow_status: "released",
        status: "released",
        released_at: new Date().toISOString(),
      })
      .eq("id", data.orderId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });

export const recordEscrowRefund = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { orderId: string; refundTxHash: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Authorization: only the seller (or admin) may record a refund
    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .select("id, seller_id, escrow_status, status, expires_at")
      .eq("id", data.orderId)
      .single();
    if (orderErr || !order) return { ok: false, error: "주문을 찾을 수 없습니다" };
    if (order.seller_id !== userId) {
      return { ok: false, error: "판매자만 환불을 기록할 수 있습니다" };
    }
    if (order.escrow_status !== "locked") {
      return { ok: false, error: "락업된 에스크로만 환불할 수 있습니다" };
    }

    const { error } = await supabase
      .from("orders")
      .update({
        escrow_status: "refunded",
        status: "cancelled",
        cancelled_at: new Date().toISOString(),
        cancel_reason: "에스크로 환불 (만료 또는 분쟁)",
      })
      .eq("id", data.orderId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  });
