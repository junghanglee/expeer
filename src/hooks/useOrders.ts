import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getFeeSettings } from "@/hooks/useAppSettings";
import { getMarkPriceKrw } from "@/utils/prices.functions";
import { checkOrderLimit } from "@/utils/limits.functions";
import type { Enums, Tables, TablesInsert } from "@/integrations/supabase/types";

export type Order = Tables<"orders">;
type OrderAdSummary = Pick<Tables<"ads">, "kind" | "to_asset" | "to_amount" | "asset" | "fiat">;
export type OrderWithAd = Order & { ads?: OrderAdSummary | null };
export type OrderStatus = Enums<"order_status">;

const DEMO_ORDER_PATCHES_KEY = "expeer.demo.order.patches.v1";

function canUseLocalStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readDemoOrderPatches(): Record<string, Partial<OrderWithAd>> {
  if (!canUseLocalStorage()) return {};
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_ORDER_PATCHES_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDemoOrderPatch(id: string, patch: Partial<OrderWithAd>) {
  if (!canUseLocalStorage()) return;
  const patches = readDemoOrderPatches();
  patches[id] = { ...(patches[id] ?? {}), ...patch, updated_at: new Date().toISOString() };
  window.localStorage.setItem(DEMO_ORDER_PATCHES_KEY, JSON.stringify(patches));
}

function applyDemoOrderPatch(order: OrderWithAd): OrderWithAd {
  return { ...order, ...(readDemoOrderPatches()[order.id] ?? {}) };
}

function statusMatches(order: OrderWithAd, status?: OrderStatus | OrderStatus[]) {
  if (!status) return true;
  return Array.isArray(status) ? status.includes(order.status) : order.status === status;
}

function roleMatches(order: OrderWithAd, userId: string, role: "buyer" | "seller" | "any") {
  if (role === "buyer") return order.buyer_id === userId;
  if (role === "seller") return order.seller_id === userId;
  return order.buyer_id === userId || order.seller_id === userId;
}

function demoOrders(myUserId = "demo-current-user") {
  return [
    makeDemoOrder("demo-order-sell-usdc-1"),
    makeDemoOrder("demo-order-buy-usdt-1"),
  ]
    .filter((order): order is OrderWithAd => !!order)
    .map((order) => ({
      ...order,
      buyer_id: order.buyer_id === "demo-current-user" ? myUserId : order.buyer_id,
      seller_id: order.seller_id === "demo-current-user" ? myUserId : order.seller_id,
    }))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function makeDemoOrder(id: string): OrderWithAd | null {
  if (!id.startsWith("demo-order-")) return null;
  const adId = id.replace(/^demo-order-/, "demo-");
  const isUsdc = adId.includes("usdc");
  const isBuyAd = adId.includes("buy");
  const asset = isUsdc ? "USDC" : "USDT";
  const price = isUsdc ? 1378 : isBuyAd ? 1371 : 1376;
  const amount = isBuyAd ? 145.8789 : 181.686;
  const fiatAmount = Math.round(amount * price);
  const now = new Date().toISOString();
  const base: OrderWithAd = {
    id,
    ad_id: adId,
    amount,
    asset,
    buyer_bank_account_id: "demo-buyer-bank",
    buyer_cancel_requested_at: null,
    buyer_fee_amount: Math.round(amount * 0.01 * 1_000_000) / 1_000_000,
    buyer_fee_pct: 1,
    buyer_id: isBuyAd ? "demo-merchant-buy-1" : "demo-current-user",
    buyer_wallet_id: "demo-buyer-wallet",
    cancel_reason: null,
    cancelled_at: null,
    chain: "base-sepolia",
    completed_at: null,
    confirmed_at: null,
    created_at: now,
    escrow_contract_address: null,
    escrow_lock_tx_hash: null,
    escrow_order_id: null,
    escrow_order_id_hash: null,
    escrow_release_tx_hash: null,
    escrow_status: "none",
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    fiat: "KRW",
    fiat_amount: fiatAmount,
    network: "Base Sepolia",
    paid_at: null,
    payment_metadata: { demo: true },
    price,
    price_snapshot_at: now,
    price_snapshot_krw: price,
    price_source: "demo",
    released_at: null,
    seller_bank_account_id: "demo-seller-bank",
    seller_cancel_requested_at: null,
    seller_fee_amount: Math.round(amount * 0.01 * 1_000_000) / 1_000_000,
    seller_fee_pct: 1,
    seller_id: isBuyAd ? "demo-current-user" : "demo-merchant-sell-1",
    status: "created",
    updated_at: now,
    ads: { kind: "fiat", to_asset: null, to_amount: null, asset, fiat: "KRW" },
  };
  return applyDemoOrderPatch(base);
}

export interface OrderFilters {
  status?: OrderStatus | OrderStatus[];
  role?: "buyer" | "seller" | "any";
}

export function useOrders(filters: OrderFilters = {}) {
  const { user } = useAuth();
  const [orders, setOrders] = useState<OrderWithAd[]>([]);
  const [loading, setLoading] = useState(true);
  const role = filters.role ?? "any";
  const status = filters.status;

  const load = useCallback(async () => {
    if (!user) {
      const demo = demoOrders().filter(
        (order) => statusMatches(order, status) && roleMatches(order, "demo-current-user", role),
      );
      setOrders(demo);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase
      .from("orders")
      .select("*, ads(kind,to_asset,to_amount,asset,fiat)")
      .order("created_at", { ascending: false });
    if (role === "buyer") q = q.eq("buyer_id", user.id);
    else if (role === "seller") q = q.eq("seller_id", user.id);
    else q = q.or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`);
    if (status) {
      if (Array.isArray(status)) q = q.in("status", status);
      else q = q.eq("status", status);
    }
    const { data } = await q;
    const demo = demoOrders(user.id).filter(
      (order) => statusMatches(order, status) && roleMatches(order, user.id, role),
    );
    setOrders([...(demo ?? []), ...((data ?? []) as OrderWithAd[])]);
    setLoading(false);
  }, [user, role, status]);

  useEffect(() => {
    load();
  }, [load]);
  return { orders, loading, refresh: load };
}

export function useOrder(id: string | undefined) {
  const [order, setOrder] = useState<OrderWithAd | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) {
      setOrder(null);
      setLoading(false);
      return;
    }
    if (id.startsWith("demo-order-")) {
      setOrder(makeDemoOrder(id));
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("orders")
      .select("*, ads(kind,to_asset,to_amount,asset,fiat)")
      .eq("id", id)
      .maybeSingle();
    setOrder((data ?? null) as OrderWithAd | null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);
  return { order, loading, refresh: load };
}

export async function createOrder(input: TablesInsert<"orders">, accessToken?: string) {
  if (input.ad_id.startsWith("demo-")) {
    const id = `demo-order-${input.ad_id.replace(/^demo-/, "")}`;
    const now = new Date().toISOString();
    writeDemoOrderPatch(id, {
      ...input,
      id,
      status: "created",
      created_at: now,
      updated_at: now,
      payment_metadata: { demo: true },
    } as Partial<OrderWithAd>);
    return makeDemoOrder(id) as Order;
  }

  const fiatAmount = Number(input.fiat_amount);
  const { data: authData } = await supabase.auth.getUser();
  const currentUserId = authData.user?.id;

  const { data: sourceAd } = await supabase
    .from("ads")
    .select("kind,to_asset,to_amount,available_amount,total_amount,filled_amount,user_id")
    .eq("id", input.ad_id)
    .maybeSingle();
  const isCryptoSwapOrder = sourceAd?.kind === "crypto_swap";

  // KYC 한도 사전 체크. 교환 주문은 법정화폐가 없으므로 건너뛴다.
  if (!isCryptoSwapOrder && (input.fiat === "KRW" || !input.fiat)) {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const limit = await checkOrderLimit({
      data: { fiatAmountKrw: fiatAmount },
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!limit.ok) throw new Error(limit.reason ?? "거래 한도를 초과합니다");
  }

  const tradeApproval = await import("@/utils/tradeApproval.functions").then((m) =>
    m.checkTradeApproval({
      data: {
        counterpartyId:
          input.buyer_id === input.seller_id
            ? null
            : input.buyer_id === currentUserId
              ? input.seller_id
              : input.buyer_id,
      },
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    }),
  );
  if (!tradeApproval.ok) throw new Error(tradeApproval.message ?? "거래 승인 확인에 실패했습니다");

  // 주문 생성 시점의 수수료를 스냅샷으로 저장한다.
  const fees = await getFeeSettings();
  const buyerFeePct = Number(input.buyer_fee_pct ?? fees.buyer_pct);
  const sellerFeePct = Number(input.seller_fee_pct ?? fees.seller_pct);
  const feeBase = isCryptoSwapOrder ? Number(input.amount) : fiatAmount;
  const buyerFeeAmount = Math.round(feeBase * buyerFeePct) / 100;
  const sellerFeeAmount = Math.round(feeBase * sellerFeePct) / 100;

  // 시세 스냅샷은 환전 주문에만 저장한다. 실패해도 주문은 생성한다.
  let priceSnapshotKrw: number | null = null;
  let priceSource: string | null = null;
  let priceSnapshotAt: string | null = null;
  if (!isCryptoSwapOrder) {
    try {
      const snap = await getMarkPriceKrw({ data: { symbol: input.asset } });
      priceSnapshotKrw = snap.priceKrw;
      priceSource = snap.source;
      priceSnapshotAt = snap.at;
    } catch (e) {
      console.warn("[createOrder] price snapshot failed:", e);
    }
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

  const { error: messageError } = await supabase.from("messages").insert({
    order_id: order.id,
    sender_id: order.buyer_id,
    type: "text",
    content: isCryptoSwapOrder
      ? "교환 거래방이 생성되었습니다. 양측 지갑과 락업 조건을 확인한 뒤 진행하겠습니다."
      : "거래방이 생성되었습니다. 상대방 확인 후 안내에 따라 거래를 진행하겠습니다.",
    metadata: { event: "order_created" },
  });
  if (messageError) throw messageError;

  // 하나의 오퍼를 여러 주문으로 부분 체결한다.
  if (sourceAd) {
    const nextAvailable = Math.max(0, Number(sourceAd.available_amount) - Number(input.amount));
    const nextFilled = Math.min(
      Number(sourceAd.total_amount),
      Number(sourceAd.filled_amount ?? 0) + Number(input.amount),
    );
    const adUpdate: Partial<Tables<"ads">> = {
      available_amount: nextAvailable,
      filled_amount: nextFilled,
    };
    if (nextAvailable <= 0) adUpdate.status = "completed";
    await supabase.from("ads").update(adUpdate).eq("id", input.ad_id);
  }
  return order;
}

export async function markOrderPaid(id: string) {
  if (id.startsWith("demo-order-")) {
    writeDemoOrderPatch(id, { status: "paid", paid_at: new Date().toISOString() });
    return;
  }
  const { error } = await supabase
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markProofUploaded(id: string) {
  if (id.startsWith("demo-order-")) {
    writeDemoOrderPatch(id, { status: "proof_uploaded" });
    return;
  }
  const { error } = await supabase.from("orders").update({ status: "proof_uploaded" }).eq("id", id);
  if (error) throw error;
}

export async function confirmPayment(id: string) {
  if (id.startsWith("demo-order-")) {
    writeDemoOrderPatch(id, { status: "confirmed", confirmed_at: new Date().toISOString() });
    return;
  }
  const { error } = await supabase
    .from("orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function releaseOrder(id: string) {
  const now = new Date().toISOString();
  if (id.startsWith("demo-order-")) {
    writeDemoOrderPatch(id, {
      status: "completed",
      confirmed_at: now,
      released_at: now,
      completed_at: now,
    });
    return;
  }
  const { data: current, error: readError } = await supabase
    .from("orders")
    .select("status")
    .eq("id", id)
    .single();
  if (readError) throw readError;
  if (current.status === "paid" || current.status === "proof_uploaded") {
    const { error: confirmError } = await supabase
      .from("orders")
      .update({ status: "confirmed", confirmed_at: now })
      .eq("id", id);
    if (confirmError) throw confirmError;
  }
  const { error } = await supabase
    .from("orders")
    .update({ status: "completed", released_at: now, completed_at: now })
    .eq("id", id);
  if (error) throw error;
}

export async function cancelOrder(id: string) {
  if (id.startsWith("demo-order-")) {
    writeDemoOrderPatch(id, { status: "cancelled", cancelled_at: new Date().toISOString() });
    return;
  }
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
  if (id.startsWith("demo-order-")) {
    const update: Partial<OrderWithAd> =
      role === "buyer"
        ? { buyer_cancel_requested_at: new Date().toISOString() }
        : { seller_cancel_requested_at: new Date().toISOString() };
    if (reason) update.cancel_reason = reason;
    writeDemoOrderPatch(id, update);
    return;
  }
  const update: Partial<Tables<"orders">> =
    role === "buyer"
      ? { buyer_cancel_requested_at: new Date().toISOString() }
      : { seller_cancel_requested_at: new Date().toISOString() };
  if (reason) update.cancel_reason = reason;
  const { error } = await supabase.from("orders").update(update).eq("id", id);
  if (error) throw error;
}

export async function withdrawCancelRequest(id: string, role: "buyer" | "seller") {
  if (id.startsWith("demo-order-")) {
    writeDemoOrderPatch(
      id,
      role === "buyer" ? { buyer_cancel_requested_at: null } : { seller_cancel_requested_at: null },
    );
    return;
  }
  const update: Partial<Tables<"orders">> =
    role === "buyer" ? { buyer_cancel_requested_at: null } : { seller_cancel_requested_at: null };
  const { error } = await supabase.from("orders").update(update).eq("id", id);
  if (error) throw error;
}
