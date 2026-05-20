import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getFeeSettings } from "@/hooks/useAppSettings";
import { getMarkPriceKrw } from "@/utils/prices.functions";
import { checkOrderLimit } from "@/utils/limits.functions";
import type { Tables, TablesInsert, Enums } from "@/integrations/supabase/types";

export type Order = Tables<"orders">;
export type OrderStatus = Enums<"order_status">;

export interface OrderFilters {
  status?: OrderStatus | OrderStatus[];
  role?: "buyer" | "seller" | "any";
}

export function useOrders(filters: OrderFilters = {}) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase.from("orders").select("*").order("created_at", { ascending: false });
    const role = filters.role ?? "any";
    if (role === "buyer") q = q.eq("buyer_id", user.id);
    else if (role === "seller") q = q.eq("seller_id", user.id);
    else q = q.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
    if (filters.status) {
      if (Array.isArray(filters.status)) q = q.in("status", filters.status);
      else q = q.eq("status", filters.status);
    }
    const { data } = await q;
    setOrders(data ?? []);
    setLoading(false);
  }, [user, filters.role, JSON.stringify(filters.status)]);

  useEffect(() => {
    load();
  }, [load]);

  return { orders, loading, refresh: load };
}

export function useOrder(id: string | undefined) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setOrder(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
    setOrder(data ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { order, loading, refresh: load };
}

export async function createOrder(input: TablesInsert<"orders">) {
  const fiatAmount = Number(input.fiat_amount);

  // KYC 한도 사전 체크 (KRW 기준). 실패 시 명확한 메시지로 throw.
  if (input.fiat === "KRW" || !input.fiat) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const limit = await checkOrderLimit({
      data: { fiatAmountKrw: fiatAmount },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!limit.ok) {
      throw new Error(limit.reason ?? "거래 한도를 초과합니다");
    }
  }

  // 주문 생성 시점의 수수료를 스냅샷으로 저장 (이후 관리자 변경에 영향받지 않음)
  const fees = await getFeeSettings();
  const buyerFeePct = Number(input.buyer_fee_pct ?? fees.buyer_pct);
  const sellerFeePct = Number(input.seller_fee_pct ?? fees.seller_pct);
  const buyerFeeAmount = Math.round(fiatAmount * buyerFeePct) / 100;
  const sellerFeeAmount = Math.round(fiatAmount * sellerFeePct) / 100;

  // 시세 스냅샷 (분쟁 근거). 실패 시 null 로 진행 — 주문은 생성된다.
  let priceSnapshotKrw: number | null = null;
  let priceSource: string | null = null;
  let priceSnapshotAt: string | null = null;
  try {
    const snap = await getMarkPriceKrw({ data: { symbol: input.asset } });
    priceSnapshotKrw = snap.priceKrw;
    priceSource = snap.source;
    priceSnapshotAt = snap.at;
  } catch (e) {
    console.warn("[createOrder] price snapshot failed:", e);
  }

  const payload: TablesInsert<"orders"> = {
    ...input,
    buyer_fee_pct: buyerFeePct,
    seller_fee_pct: sellerFeePct,
    buyer_fee_amount: buyerFeeAmount,
    seller_fee_amount: sellerFeeAmount,
    price_snapshot_krw: priceSnapshotKrw,
    price_source: priceSource,
    price_snapshot_at: priceSnapshotAt,
  };

  const { data: order, error } = await supabase.from("orders").insert(payload).select().single();
  if (error) throw error;

  // 주문 생성 직후 거래방에 첫 안내 메시지를 남겨 채팅방 진입 시 빈 화면이 되지 않게 한다.
  // 현재 RLS는 sender_id = auth.uid() 메시지만 허용하므로 주문 생성자인 buyer 메시지로 기록한다.
  const { error: messageError } = await supabase.from("messages").insert({
    order_id: order.id,
    sender_id: order.buyer_id,
    type: "text",
    content: "거래방이 생성되었습니다. 상대방 확인 후 안내에 따라 거래를 진행하겠습니다.",
    metadata: { event: "order_created" },
  });
  if (messageError) throw messageError;

  // Decrease ad available_amount
  const { data: ad } = await supabase
    .from("ads")
    .select("available_amount,total_amount")
    .eq("id", input.ad_id)
    .maybeSingle();
  if (ad) {
    const next = Number(ad.available_amount) - Number(input.amount);
    await supabase
      .from("ads")
      .update({ available_amount: Math.max(0, next) })
      .eq("id", input.ad_id);
  }
  return order;
}

export async function markOrderPaid(id: string) {
  const { error } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markProofUploaded(id: string) {
  const { error } = await supabase.from("orders").update({ status: "proof_uploaded" }).eq("id", id);
  if (error) throw error;
}

export async function confirmPayment(id: string) {
  const { error } = await supabase
    .from("orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function releaseOrder(id: string) {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "completed",
      released_at: now,
      completed_at: now,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelOrder(id: string) {
  const { error } = await supabase
    .from("orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * 입금 전 단계: 일방 취소 가능 (cancelOrder).
 * 입금 후 단계: 양측 합의 필요 — buyer/seller가 각자 requestCancel을 호출하면
 * DB 트리거가 양측 모두 요청 시 자동으로 cancelled 처리.
 */
export async function requestCancel(id: string, role: "buyer" | "seller", reason?: string) {
  const update: Partial<Tables<"orders">> =
    role === "buyer"
      ? { buyer_cancel_requested_at: new Date().toISOString() }
      : { seller_cancel_requested_at: new Date().toISOString() };
  if (reason) update.cancel_reason = reason;
  const { error } = await supabase.from("orders").update(update).eq("id", id);
  if (error) throw error;
}

export async function withdrawCancelRequest(id: string, role: "buyer" | "seller") {
  const update: Partial<Tables<"orders">> =
    role === "buyer" ? { buyer_cancel_requested_at: null } : { seller_cancel_requested_at: null };
  const { error } = await supabase.from("orders").update(update).eq("id", id);
  if (error) throw error;
}
