import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  Bell,
  Clock,
  Loader2,
  MessageSquare,
  ShieldCheck,
  X,
} from "lucide-react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { Section } from "@/components/espeer/Section";
import { BigNumber } from "@/components/espeer/BigNumber";
import { useAuth } from "@/lib/auth";
import { useCounterpartyTrust } from "@/hooks/useCounterpartyTrust";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/app/selling")({
  head: () => ({ meta: [{ title: "활동 — EXPEER" }] }),
  component: ActivityPage,
});

type KindTab = "all" | "fiat" | "crypto";
type StatusTab = "all" | "progress" | "completed";
type Order = Tables<"orders">;
type Profile = Pick<
  Tables<"profiles">,
  "id" | "nickname" | "email" | "kyc_status" | "trade_count" | "rating"
>;
type Message = Pick<
  Tables<"messages">,
  "order_id" | "content" | "created_at" | "sender_id" | "read_at" | "type"
>;
type AdSummary = Pick<Tables<"ads">, "kind" | "asset" | "fiat" | "to_asset" | "to_amount">;

type ActivityOrder = Order & {
  ads?: AdSummary | null;
  counterpart?: Profile | null;
  lastMessage?: Message | null;
  unread: number;
};

const progressStatuses = [
  "created",
  "info_shared",
  "paid",
  "proof_uploaded",
  "confirmed",
  "released",
  "disputed",
];
const completedStatuses = ["completed", "cancelled", "expired"];

function ActivityPage() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useAuth();
  const [kindTab, setKindTab] = useState<KindTab>("all");
  const [statusTab, setStatusTab] = useState<StatusTab>("all");
  const [sheetStatus, setSheetStatus] = useState<StatusTab | null>(null);
  const [orders, setOrders] = useState<ActivityOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!user) {
        setOrders([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data: orderRows, error } = await supabase
        .from("orders")
        .select("*, ads(kind,asset,fiat,to_asset,to_amount)")
        .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
        .order("created_at", { ascending: false });

      if (cancelled) return;
      if (error || !orderRows?.length) {
        setOrders([]);
        setLoading(false);
        return;
      }

      const counterpartIds = Array.from(
        new Set(orderRows.map((o) => (o.buyer_id === user.id ? o.seller_id : o.buyer_id))),
      );
      const orderIds = orderRows.map((o) => o.id);
      const [{ data: profiles }, { data: messageRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,nickname,email,kyc_status,trade_count,rating")
          .in("id", counterpartIds),
        supabase
          .from("messages")
          .select("order_id,content,created_at,sender_id,read_at,type")
          .in("order_id", orderIds)
          .order("created_at", { ascending: false }),
      ]);
      if (cancelled) return;

      const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));
      const lastByOrder = new Map<string, Message>();
      const unreadByOrder = new Map<string, number>();
      for (const m of messageRows ?? []) {
        if (!lastByOrder.has(m.order_id)) lastByOrder.set(m.order_id, m);
        if (m.sender_id && m.sender_id !== user.id && !m.read_at)
          unreadByOrder.set(m.order_id, (unreadByOrder.get(m.order_id) ?? 0) + 1);
      }

      setOrders(
        orderRows.map((order) => {
          const counterpartId = order.buyer_id === user.id ? order.seller_id : order.buyer_id;
          return {
            ...order,
            counterpart: profileById.get(counterpartId) ?? null,
            lastMessage: lastByOrder.get(order.id) ?? null,
            unread: unreadByOrder.get(order.id) ?? 0,
          };
        }),
      );
      setLoading(false);
    }

    load();
    const channel = supabase
      .channel(`activity-orders:${user?.id ?? "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, load)
      .subscribe();
    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const stats = useMemo(() => {
    const progress = orders.filter((o) => matchesStatus(o, "progress"));
    const completed = orders.filter((o) => matchesStatus(o, "completed"));
    return {
      total: orders.length,
      progress: progress.length,
      completed: completed.length,
      totalKrw: orders.reduce((sum, o) => sum + (!isCryptoOrder(o) ? Number(o.fiat_amount) : 0), 0),
      unread: orders.reduce((sum, o) => sum + o.unread, 0),
    };
  }, [orders]);

  const list = useMemo(
    () => orders.filter((o) => matchesKind(o, kindTab) && matchesStatus(o, statusTab)),
    [orders, kindTab, statusTab],
  );
  const sheetList = useMemo(
    () => (sheetStatus ? orders.filter((o) => matchesStatus(o, sheetStatus)) : []),
    [orders, sheetStatus],
  );

  if (pathname !== "/app/selling") return <Outlet />;

  return (
    <PhoneShell>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-foreground">활동</div>
            <div className="text-[10px] font-semibold text-muted-foreground">
              실제 주문 · 진행 중 거래 · 완료 채팅 내역
            </div>
          </div>
        </div>
        <Link
          to="/app/notifications"
          className="relative flex h-9 w-9 items-center justify-center rounded-full bg-surface"
        >
          <Bell className="h-4 w-4" />
          {stats.unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {stats.unread}
            </span>
          )}
        </Link>
      </header>

      <div className="px-5 pt-4">
        <BigNumber
          value={fmtKrw(stats.totalKrw).replace("₩", "")}
          unit="KRW"
          size="lg"
          tone="primary"
          caption="실제 환전 거래 누적 금액"
        />
      </div>

      <Section>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-2.5">
          <KPI
            label="전체"
            value={String(stats.total)}
            active={statusTab === "all"}
            onClick={() => {
              setStatusTab("all");
              setSheetStatus("all");
            }}
          />
          <KPI
            label="진행 중"
            value={String(stats.progress)}
            active={statusTab === "progress"}
            onClick={() => {
              setStatusTab("progress");
              setSheetStatus("progress");
            }}
          />
          <KPI
            label="완료"
            value={String(stats.completed)}
            active={statusTab === "completed"}
            onClick={() => {
              setStatusTab("completed");
              setSheetStatus("completed");
            }}
          />
        </div>
      </Section>

      <div className="mx-5 flex items-start gap-2 rounded-xl border border-primary-soft bg-primary-soft/60 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-[11px] leading-relaxed text-foreground/80">
          주문이 생성되면 실제 거래방이 표시됩니다. 상대 확인, 입금/락업 확인, 증빙 제출은 거래방과
          채팅을 중심으로 진행합니다.
        </div>
      </div>

      <section className="px-4 py-3">
        <div className="mb-2.5 flex min-w-0 items-center gap-2">
          <h2 className="shrink-0 whitespace-nowrap text-[14px] font-bold text-foreground">
            거래 내역
          </h2>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto px-px pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <CompactFilter active={kindTab === "all"} onClick={() => setKindTab("all")}>
              전체
            </CompactFilter>
            <CompactFilter active={kindTab === "fiat"} onClick={() => setKindTab("fiat")}>
              환전
            </CompactFilter>
            <CompactFilter active={kindTab === "crypto"} onClick={() => setKindTab("crypto")}>
              교환
            </CompactFilter>
            <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
            <CompactFilter active={statusTab === "all"} onClick={() => setStatusTab("all")}>
              전체
            </CompactFilter>
            <CompactFilter
              active={statusTab === "progress"}
              onClick={() => setStatusTab("progress")}
            >
              진행 중
            </CompactFilter>
            <CompactFilter
              active={statusTab === "completed"}
              onClick={() => setStatusTab("completed")}
            >
              완료
            </CompactFilter>
          </div>
        </div>

        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : list.length > 0 ? (
            list.map((order) => <ActivityCard key={order.id} order={order} userId={user?.id} />)
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-card py-10 text-center text-[12px] text-muted-foreground">
              아직 표시할 실제 거래방이 없습니다.
              <br />
              P2P환전 또는 P2P교환에서 주문을 만들면 여기에 표시됩니다.
            </div>
          )}
        </div>
      </section>

      {sheetStatus && (
        <ActivitySheet
          status={sheetStatus}
          orders={sheetList}
          userId={user?.id}
          onClose={() => setSheetStatus(null)}
        />
      )}
      <div className="h-6" />
    </PhoneShell>
  );
}

function isCryptoOrder(order: ActivityOrder | Order) {
  return "ads" in order && order.ads?.kind === "crypto_swap";
}

function matchesKind(order: ActivityOrder, kind: KindTab) {
  if (kind === "all") return true;
  return kind === "crypto" ? isCryptoOrder(order) : !isCryptoOrder(order);
}

function matchesStatus(order: Order, status: StatusTab) {
  if (status === "all") return true;
  if (status === "progress") return progressStatuses.includes(order.status);
  return completedStatuses.includes(order.status);
}

function sheetTitle(status: StatusTab) {
  if (status === "progress") return "진행 중 거래방";
  if (status === "completed") return "완료된 거래방";
  return "전체 거래방";
}

function KPI({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-xl px-1 py-1.5 text-center transition-colors ${active ? "bg-foreground text-background" : "bg-surface text-foreground"}`}
    >
      <div className="num-display min-w-0 truncate text-[16px] leading-none">{value}</div>
      <div className="mt-0.5 min-w-0 truncate text-[10px] font-bold">{label}</div>
    </button>
  );
}

function CompactFilter({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[10.5px] font-bold transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
    >
      {children}
    </button>
  );
}

function statusLabel(status: string) {
  return (
    {
      created: "대기",
      info_shared: "정보 공유",
      paid: "송금/락업 완료",
      proof_uploaded: "증빙 제출",
      confirmed: "확인 중",
      released: "릴리즈 완료",
      completed: "완료",
      cancelled: "취소",
      disputed: "분쟁 중",
      expired: "만료",
    }[status] ?? status
  );
}

function roleLabel(order: Order, userId?: string) {
  if (!userId) return "참여자";
  return order.buyer_id === userId ? "참여자" : "오퍼 등록자";
}

function nextAction(order: ActivityOrder, userId?: string) {
  const isBuyer = order.buyer_id === userId;
  const isSeller = order.seller_id === userId;
  const crypto = isCryptoOrder(order);
  if (order.status === "created" || order.status === "info_shared")
    return crypto ? "지갑 확인 후 락업 준비" : isBuyer ? "입금 후 완료 표시" : "상대 입금 대기";
  if (order.status === "paid" || order.status === "proof_uploaded")
    return crypto ? "락업/전송 증빙 확인" : isSeller ? "입금 확인 후 릴리즈" : "판매자 확인 대기";
  if (order.status === "confirmed" || order.status === "released")
    return crypto ? "교환 수령 확인" : "코인 전송/수령 확인";
  if (order.status === "disputed") return "분쟁 증빙 확인";
  if (order.status === "completed") return "거래 완료 · 평가 가능";
  return "거래 종료";
}

function fmtKrw(n: number) {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}

function fmtAmount(n: number) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 6 });
}

function orderSummary(order: ActivityOrder) {
  if (isCryptoOrder(order)) {
    return `${order.asset} ${fmtAmount(Number(order.amount))} → ${order.ads?.to_asset ?? order.fiat} ${fmtAmount(Number(order.ads?.to_amount ?? order.fiat_amount))}`;
  }
  return `${order.asset} ${fmtAmount(Number(order.amount))} · ${fmtKrw(Number(order.fiat_amount))}`;
}

function ActivityCard({ order, userId }: { order: ActivityOrder; userId?: string }) {
  const crypto = isCryptoOrder(order);
  const chatEnabled = order.status !== "expired";
  const counterpartId = order.buyer_id === userId ? order.seller_id : order.buyer_id;
  const { profile: trustProfile, rating, blacklistStatus } = useCounterpartyTrust(counterpartId);
  const counterpartName =
    trustProfile?.nickname ??
    trustProfile?.email?.split("@")[0] ??
    order.counterpart?.nickname ??
    order.counterpart?.email?.split("@")[0] ??
    "거래 상대";

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${crypto ? "bg-primary-soft text-primary" : "bg-success-soft text-success"}`}
            >
              {crypto ? "P2P교환" : "P2P환전"}
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {statusLabel(order.status)}
            </span>
          </div>
          <div className="mt-2 truncate text-[14px] font-extrabold text-foreground">
            {orderSummary(order)}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            주문 #{order.id.slice(-6)} · {roleLabel(order, userId)} ·{" "}
            {new Date(order.created_at).toLocaleDateString("ko-KR")}
          </div>
        </div>
        {order.counterpart?.kyc_status === "approved" && (
          <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
        )}
      </div>

      <div className="mt-2 rounded-xl bg-surface p-2.5">
        <InfoRow label="상대방" value={counterpartName} />
        <InfoRow
          label="평가/검증"
          value={`${rating > 0 ? `★ ${rating.toFixed(2)}` : "평가 대기"} · ${blacklistStatus === "clear" ? "블랙리스트 이상 없음" : blacklistStatus === "phone_required" ? "전화번호 등록 필요" : "확인 필요"}`}
        />
        <InfoRow label="다음 업무" value={nextAction(order, userId)} />
        <InfoRow label="최근 채팅" value={order.lastMessage?.content ?? "대화 없음"} />
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
        <span className="rounded-lg bg-primary-soft py-1.5 text-primary">상대 평가</span>
        <span className="rounded-lg bg-success-soft py-1.5 text-success">검증 상태</span>
        <span className="rounded-lg bg-warning-soft py-1.5 text-warning">증빙 보존</span>
      </div>

      {order.status === "disputed" && (
        <Link
          to="/app/order/$orderId/dispute"
          params={{ orderId: order.id }}
          className="mt-2 block rounded-xl border border-border bg-surface px-3 py-2 text-center text-[11px] font-bold text-foreground/80"
        >
          제출용 거래 자료 다운로드
        </Link>
      )}
      {completedStatuses.includes(order.status) && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          <Clock className="mr-0.5 inline h-3 w-3" /> 완료/종료된 거래도 상세와 채팅 기록을 다시
          확인할 수 있습니다.
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {chatEnabled ? (
          <Link
            to="/app/order/$orderId/chat"
            params={{ orderId: order.id }}
            className="relative z-10 flex items-center justify-center gap-1 rounded-xl bg-primary py-3 text-[12px] font-bold text-primary-foreground"
          >
            <MessageSquare className="h-4 w-4" />
            채팅 열기
            {order.unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                {order.unread}
              </span>
            )}
          </Link>
        ) : (
          <span className="flex cursor-not-allowed items-center justify-center gap-1 rounded-xl bg-surface py-3 text-[12px] font-bold text-muted-foreground">
            <MessageSquare className="h-4 w-4" />
            채팅 만료
          </span>
        )}
        <Link
          to="/app/order/$orderId"
          params={{ orderId: order.id }}
          className="relative z-10 flex items-center justify-center gap-1 rounded-xl bg-surface py-3 text-[12px] font-bold text-foreground/80"
        >
          거래 상세 <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
      <span className="text-muted-foreground">{label}</span>
      <b className="max-w-[190px] truncate text-right text-foreground">{value}</b>
    </div>
  );
}

function ActivitySheet({
  status,
  orders,
  userId,
  onClose,
}: {
  status: StatusTab;
  orders: ActivityOrder[];
  userId?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/35" onClick={onClose}>
      <div
        className="w-full animate-in slide-in-from-bottom duration-200 rounded-t-3xl border border-border bg-background p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="text-[15px] font-extrabold text-foreground">{sheetTitle(status)}</div>
            <div className="text-[11px] text-muted-foreground">
              실제 주문 거래방을 빠르게 확인합니다.
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-surface"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[52vh] space-y-2 overflow-y-auto pb-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              to="/app/order/$orderId/chat"
              params={{ orderId: order.id }}
              onClick={onClose}
              className="block w-full rounded-2xl border border-border bg-card p-3 text-left"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-extrabold text-foreground">
                    {orderSummary(order)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    {roleLabel(order, userId)} · {statusLabel(order.status)}
                  </div>
                </div>
                <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
