import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Send, AlertTriangle, Loader2, ShieldAlert, Check } from "lucide-react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { useAuth } from "@/lib/auth";
import { useOrder, markOrderPaid, releaseOrder, requestDemoDispute } from "@/hooks/useOrders";
import { useMessages, sendMessage } from "@/hooks/useMessages";
import { useEscrowVault } from "@/hooks/useEscrowVault";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const search = z.object({
  role: z.enum(["buyer", "seller"]).optional(),
});

export const Route = createFileRoute("/app/order/$orderId/chat")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "거래 채팅 — EXPEER" }] }),
  component: ChatRoom,
});

const STATUS_LABEL: Record<string, string> = {
  created: "결제 대기",
  info_shared: "정보 공유",
  paid: "송금/락업 완료",
  proof_uploaded: "증빙 제출",
  confirmed: "상대 확인",
  released: "릴리즈 완료",
  completed: "거래 완료",
  cancelled: "취소됨",
  disputed: "분쟁 중",
  expired: "만료됨",
};

function fmtTs(iso: string) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function ChatRoom() {
  const { orderId } = Route.useParams();
  const { user } = useAuth();
  const { order, loading: orderLoading, refresh: refreshOrder } = useOrder(orderId);
  const { messages, loading: msgLoading, refresh: refreshMessages } = useMessages(orderId);
  const isDemo = orderId.startsWith("demo-order-");
  const actorId = isDemo ? "demo-current-user" : user?.id;
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [counterpartyName, setCounterpartyName] = useState<string>("");
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    (async () => {
      if (!order) return;
      if (isDemo) {
        setCounterpartyName("EXPEER 테스트 상대");
        return;
      }
      if (!user) return;
      const otherId = user.id === order.buyer_id ? order.seller_id : order.buyer_id;
      const { data } = await supabase
        .from("profiles")
        .select("nickname,email")
        .eq("id", otherId)
        .maybeSingle();
      setCounterpartyName(data?.nickname || data?.email?.split("@")[0] || "거래 상대");
    })();
  }, [order, user, isDemo]);

  const send = async () => {
    if (!input.trim() || !actorId || !order || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await sendMessage(order.id, actorId, text);
      await refreshMessages();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "전송 실패");
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  if (orderLoading || !order) {
    return (
      <PhoneShell hideTab>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </PhoneShell>
    );
  }

  const isBuyer = isDemo ? order.buyer_id === "demo-current-user" : user?.id === order.buyer_id;
  const status = order.status;
  const isCryptoSwap = order.ads?.kind === "crypto_swap";

  return (
    <PhoneShell hideTab>
      <AppHeader
        title={counterpartyName || "거래 채팅"}
        subtitle={`주문 #${order.id.slice(-4)} · ${STATUS_LABEL[status]}`}
        right={
          <Link
            to="/app/order/$orderId"
            params={{ orderId: order.id }}
            className="shrink-0 text-[12px] font-bold text-primary"
          >
            상세
          </Link>
        }
      />

      <div className="min-w-0 overflow-hidden break-words bg-warning-soft px-4 py-2 text-[11px] font-medium text-warning-foreground">
        <AlertTriangle className="mr-1 inline h-3 w-3" />
        거래 조건·계좌·지갑 변경 요청은 반드시 여기서 확인하세요. 모든 대화는 증빙으로 보존됩니다.
      </div>

      <StatusCard status={status} isBuyer={isBuyer} isCryptoSwap={isCryptoSwap} />
      <ActionBar
        order={order}
        isBuyer={isBuyer}
        userId={actorId}
        onOrderChange={refreshOrder}
        isCryptoSwap={isCryptoSwap}
      />

      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-muted-foreground">
            아직 메시지가 없습니다. 첫 메시지를 보내보세요.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === actorId;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"} anim-fade-up`}
              >
                <div
                  className={`max-w-[78%] overflow-hidden rounded-2xl px-3.5 py-2 text-[13px] ${mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-surface text-foreground"}`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  <div
                    className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${mine ? "text-white/70" : "text-muted-foreground"}`}
                  >
                    {fmtTs(m.created_at)}
                    {mine && m.read_at && <Check className="h-3 w-3" />}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="sticky bottom-0 z-10 border-t border-border bg-background px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 rounded-full bg-surface px-3 py-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="메시지를 입력하세요"
            disabled={sending}
            className="min-w-0 flex-1 bg-transparent text-[13px] focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}

function StatusCard({
  status,
  isBuyer,
  isCryptoSwap,
}: {
  status: string;
  isBuyer: boolean;
  isCryptoSwap: boolean;
}) {
  if (status === "disputed") {
    return (
      <div className="mx-4 mt-3 overflow-hidden break-words rounded-xl border border-destructive bg-destructive-soft p-3">
        <div className="flex min-w-0 items-center gap-2 text-[12px] font-bold text-destructive">
          <ShieldAlert className="h-4 w-4 shrink-0" /> 분쟁이 진행 중입니다
        </div>
      </div>
    );
  }
  if (status === "completed" || status === "released") {
    return (
      <div className="mx-4 mt-3 overflow-hidden break-words rounded-xl border border-success bg-success-soft p-3 text-[12px] font-bold text-success">
        <Check className="mr-1 inline h-4 w-4" /> 거래가 완료되었습니다
      </div>
    );
  }
  if (status === "cancelled" || status === "expired") {
    return (
      <div className="mx-4 mt-3 overflow-hidden break-words rounded-xl bg-surface p-3 text-[12px] font-bold text-muted-foreground">
        주문이 종료되었습니다 ({STATUS_LABEL[status]})
      </div>
    );
  }
  const msg =
    status === "created" || status === "info_shared"
      ? isCryptoSwap
        ? "교환 조건과 양측 지갑을 확인한 뒤 락업을 진행하세요."
        : isBuyer
          ? "판매자 계좌로 송금 후 입금 완료를 눌러주세요."
          : "매수자의 입금을 기다리고 있어요."
      : status === "paid" || status === "proof_uploaded"
        ? isCryptoSwap
          ? "락업/전송 증빙을 확인하고 다음 단계를 진행하세요."
          : isBuyer
            ? "판매자가 입금을 확인하고 코인을 릴리즈할 예정입니다."
            : "입금을 확인한 뒤 코인을 릴리즈해 주세요."
        : "거래가 진행 중입니다.";
  return (
    <div className="mx-4 mt-3 overflow-hidden break-words rounded-xl border border-primary bg-primary-soft p-3 text-[12px] font-medium text-foreground">
      {msg}
    </div>
  );
}

type OrderRow = {
  id: string;
  status: string;
  escrow_status: string;
  chain: string | null;
  buyer_id: string;
  seller_id: string;
};

function ActionBar({
  order,
  isBuyer,
  userId,
  onOrderChange,
  isCryptoSwap,
}: {
  order: OrderRow;
  isBuyer: boolean;
  userId?: string;
  onOrderChange?: () => void | Promise<void>;
  isCryptoSwap: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const escrow = useEscrowVault();

  const sysMsg = async (text: string) => {
    if (!userId) return;
    try {
      await sendMessage(order.id, userId, text);
    } catch {
      /* ignore */
    }
  };

  const onBuyerMarkPaid = async () => {
    setBusy("paid");
    try {
      await markOrderPaid(order.id);
      await sysMsg(
        isCryptoSwap
          ? "락업 준비 완료를 알렸습니다. 상대방 확인을 기다립니다."
          : "입금 완료를 알렸습니다. 판매자 확인 후 코인이 릴리즈됩니다.",
      );
      await onOrderChange?.();
      toast.success(
        isCryptoSwap ? "락업 준비 완료를 알렸습니다" : "입금 완료를 판매자에게 알렸습니다",
      );
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(null);
    }
  };

  const onSellerConfirmAndRelease = async () => {
    if (
      !confirm(
        isCryptoSwap
          ? "교환 조건을 확인하고 릴리즈/완료 처리할까요?\n\n지갑 주소와 수량을 다시 확인해 주세요."
          : "입금을 직접 확인했습니까?\n\n예금주명·금액을 통장에서 확인한 뒤 코인이 릴리즈됩니다.",
      )
    )
      return;
    setBusy("release");
    try {
      if (order.escrow_status === "locked" && order.chain) {
        const tx = await escrow.release(
          order.chain as "base" | "base-sepolia" | "polygon",
          order.id,
        );
        await sysMsg(`릴리즈 트랜잭션 전송 완료: ${tx.slice(0, 10)}...`);
        await onOrderChange?.();
        toast.success("릴리즈 트랜잭션 전송 완료");
      } else {
        await releaseOrder(order.id);
        await sysMsg(
          isCryptoSwap
            ? "교환 확인이 완료되었습니다. 거래가 종료되었습니다."
            : "입금 확인 완료. 거래가 종료되었습니다.",
        );
        await onOrderChange?.();
        toast.success("거래 완료");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "릴리즈 실패");
    } finally {
      setBusy(null);
    }
  };

  const onDispute = async () => {
    const reason = prompt("분쟁 사유를 입력해 주세요. 예: 입금자명 불일치, 금액 부족, 락업 미확인");
    if (!reason?.trim()) return;
    setBusy("dispute");
    try {
      if (order.id.startsWith("demo-order-")) {
        await requestDemoDispute(order.id);
      } else {
        await supabase.from("orders").update({ status: "disputed" }).eq("id", order.id);
        await supabase.from("disputes").insert({
          order_id: order.id,
          opener_id: userId!,
          reason: reason.trim(),
          status: "open",
        });
      }
      await sysMsg(`분쟁이 접수되었습니다: ${reason.trim()}`);
      await onOrderChange?.();
      toast.success("분쟁이 접수되었습니다. 운영자가 검토합니다.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "분쟁 접수 실패");
    } finally {
      setBusy(null);
    }
  };

  if (["completed", "released", "cancelled", "expired", "disputed"].includes(order.status))
    return null;

  const showBuyerPay = isBuyer && (order.status === "created" || order.status === "info_shared");
  const showSellerRel = !isBuyer && (order.status === "paid" || order.status === "proof_uploaded");
  const showDispute = order.status === "paid" || order.status === "proof_uploaded";
  if (!showBuyerPay && !showSellerRel && !showDispute) return null;

  return (
    <div className="mx-4 mt-2 flex min-w-0 flex-col gap-2">
      {showBuyerPay && (
        <button
          onClick={onBuyerMarkPaid}
          disabled={busy !== null}
          className="min-w-0 whitespace-normal break-words rounded-xl bg-primary px-3 py-3 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy === "paid"
            ? "처리 중..."
            : isCryptoSwap
              ? "락업 준비 완료 알리기"
              : "입금 완료 알리기"}
        </button>
      )}
      {showSellerRel && (
        <button
          onClick={onSellerConfirmAndRelease}
          disabled={busy !== null || escrow.busy}
          className="min-w-0 whitespace-normal break-words rounded-xl bg-success px-3 py-3 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {busy === "release" || escrow.busy
            ? "릴리즈 중..."
            : isCryptoSwap
              ? "교환 확인 + 릴리즈"
              : "입금 확인 + 코인 릴리즈"}
        </button>
      )}
      {showDispute && (
        <button
          onClick={onDispute}
          disabled={busy !== null}
          className="min-w-0 whitespace-normal break-words rounded-xl border border-destructive bg-destructive-soft px-3 py-2.5 text-[12px] font-bold text-destructive disabled:opacity-50"
        >
          {busy === "dispute" ? "접수 중..." : "분쟁 신청"}
        </button>
      )}
      {showSellerRel && (
        <p className="break-words text-[10.5px] leading-snug text-muted-foreground">
          반드시 본인 통장/지갑에서 금액과 주소를 직접 확인한 뒤 릴리즈하세요. 완료 후에는 되돌리기
          어렵습니다.
        </p>
      )}
    </div>
  );
}
