import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { Section } from "@/components/espeer/Section";
import { BigNumber } from "@/components/espeer/BigNumber";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  Clock,
  BadgeCheck,
  Bell,
  X,
  Loader2,
} from "lucide-react";

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

type ActivityOrder = Order & {
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
        .select("*")
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
        if (m.sender_id && m.sender_id !== user.id && !m.read_at) {
          unreadByOrder.set(m.order_id, (unreadByOrder.get(m.order_id) ?? 0) + 1);
        }
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
      totalKrw: orders.reduce((sum, o) => sum + Number(o.fiat_amount), 0),
      unread: orders.reduce((sum, o) => sum + o.unread, 0),
    };
  }, [orders]);

  const list = useMemo(() => {
    return orders.filter((o) => matchesKind(o, kindTab) && matchesStatus(o, statusTab));
  }, [orders, kindTab, statusTab]);

  const sheetList = useMemo(() => {
    if (!sheetStatus) return [];
    return orders.filter((o) => matchesStatus(o, sheetStatus));
  }, [orders, sheetStatus]);

  const updateStatus = (next: StatusTab) => setStatusTab(next);
  const openSheet = (next: StatusTab) => {
    setStatusTab(next);
    setSheetStatus(next);
  };

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
              실제 거래방 · 진행중/완료 채팅내역
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
          unit="원"
          size="lg"
          tone="primary"
          caption="내 실제 누적 거래 금액"
        />
      </div>

      <Section>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-2.5">
          <KPI
            label="전체"
            value={String(stats.total)}
            active={statusTab === "all"}
            onClick={() => openSheet("all")}
          />
          <KPI
            label="진행중"
            value={String(stats.progress)}
            active={statusTab === "progress"}
            onClick={() => openSheet("progress")}
          />
          <KPI
            label="완료"
            value={String(stats.completed)}
            active={statusTab === "completed"}
            onClick={() => openSheet("completed")}
          />
        </div>
      </Section>

      <div className="mx-5 flex items-start gap-2 rounded-xl border border-primary-soft bg-primary-soft/60 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-[11px] leading-relaxed text-foreground/80">
          실제 주문이 생성되면 이곳에 거래방이 표시됩니다. 상대방 확인·입금확인·전송승인은 거래방
          채팅을 중심으로 진행됩니다.
        </div>
      </div>

      <section className="px-4 py-3">
        <div className="mb-2.5 flex min-w-0 items-center gap-2">
          <h2 className="shrink-0 whitespace-nowrap text-[14px] font-bold text-foreground">
            거래내역
          </h2>
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
            <CompactFilter active={statusTab === "all"} onClick={() => updateStatus("all")}>
              전체
            </CompactFilter>
            <CompactFilter
              active={statusTab === "progress"}
              onClick={() => updateStatus("progress")}
            >
              진행중 거래
            </CompactFilter>
            <CompactFilter
              active={statusTab === "completed"}
              onClick={() => updateStatus("completed")}
            >
              완료된 거래
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
              아직 표시할 실제 거래방이 없어요.
              <br />
              P2P환전 오퍼에서 주문을 만들면 여기에 나타납니다.
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

function matchesKind(order: Order, kind: KindTab) {
  if (kind === "all") return true;
  const isFiat = order.fiat === "KRW";
  return kind === "fiat" ? isFiat : !isFiat;
}

function matchesStatus(order: Order, status: StatusTab) {
  if (status === "all") return true;
  if (status === "progress") return progressStatuses.includes(order.status);
  return completedStatuses.includes(order.status);
}

function sheetTitle(status: StatusTab) {
  if (status === "progress") return "진행중 거래방";
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
      className={`rounded-xl py-1.5 text-center transition-colors ${active ? "bg-foreground text-background" : "bg-surface text-foreground"}`}
    >
      <div className="num-display text-[16px] leading-none">{value}</div>
      <div className="mt-0.5 text-[10px] font-bold">{label}</div>
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
      className={`shrink-0 whitespace-nowrap rounded-full border px-2 py-1 text-[10.5px] font-bold transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function statusLabel(status: string) {
  return (
    {
      created: "결제 대기",
      info_shared: "정보 공유",
      paid: "송금 완료",
      proof_uploaded: "증빙 제출",
      confirmed: "판매자 확인",
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
  return order.buyer_id === userId ? "매수자" : "매도자";
}

function nextAction(order: Order, userId?: string) {
  const isBuyer = order.buyer_id === userId;
  const isSeller = order.seller_id === userId;
  if (order.status === "created" || order.status === "info_shared")
    return isBuyer ? "입금 후 입금 완료 표시" : "매수자 입금 대기";
  if (order.status === "paid" || order.status === "proof_uploaded")
    return isSeller ? "입금 확인 후 전송 승인" : "판매자 입금 확인 대기";
  if (order.status === "confirmed" || order.status === "released") return "코인 전송/수령 확인";
  if (order.status === "disputed") return "분쟁 증빙 확인";
  if (order.status === "completed") return "거래 완료 · 평가 가능";
  return "거래 종료";
}

function fmtKrw(n: number) {
  return "₩" + Math.round(n).toLocaleString("ko-KR");
}

function fmtAmount(n: number) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
}

function ActivityCard({ order, userId }: { order: ActivityOrder; userId?: string }) {
  const isFiat = order.fiat === "KRW";
  const chatEnabled = order.status !== "expired";
  const counterpartName =
    order.counterpart?.nickname ?? order.counterpart?.email?.split("@")[0] ?? "거래 상대";

  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${isFiat ? "bg-success-soft text-success" : "bg-primary-soft text-primary"}`}
            >
              {isFiat ? "P2P환전 거래방" : "P2P교환 거래방"}
            </span>
            <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {statusLabel(order.status)}
            </span>
          </div>
          <div className="mt-2 truncate text-[14px] font-extrabold text-foreground">
            {order.asset} {fmtAmount(Number(order.amount))} · {fmtKrw(Number(order.fiat_amount))}
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
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">상대방</span>
          <b className="text-foreground">{counterpartName}</b>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">거래방 다음 업무</span>
          <b className="max-w-[190px] truncate text-right text-foreground">
            {nextAction(order, userId)}
          </b>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
          <span className="text-muted-foreground">최근 채팅</span>
          <b className="max-w-[190px] truncate text-right text-foreground">
            {order.lastMessage?.content ?? "대화 없음"}
          </b>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold">
        <span className="rounded-lg bg-primary-soft py-1.5 text-primary">상대검증</span>
        <span className="rounded-lg bg-warning-soft py-1.5 text-warning">입금확인</span>
        <span className="rounded-lg bg-success-soft py-1.5 text-success">전송승인</span>
      </div>

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
            <MessageSquare className="h-4 w-4" /> 채팅 만료
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
              실제 주문 거래방을 눌러 채팅내역과 처리상태를 확인합니다.
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
                    {order.asset} {fmtAmount(Number(order.amount))} ·{" "}
                    {fmtKrw(Number(order.fiat_amount))}
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
