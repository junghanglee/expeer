import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Send, AlertTriangle, Loader2, ShieldAlert, Check } from "lucide-react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { useAuth } from "@/lib/auth";
import { useOrder, markOrderPaid, releaseOrder } from "@/hooks/useOrders";
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
  paid: "송금 완료",
  proof_uploaded: "증빙 제출",
  confirmed: "판매자 확인",
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
  const { messages, loading: msgLoading } = useMessages(orderId);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [counterpartyName, setCounterpartyName] = useState<string>("");
  const scroller = useRef<HTMLDivElement>(null);

  // 자동 스크롤
  useEffect(() => {
    scroller.current?.scrollTo({
      top: scroller.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages]);

  // 상대방 닉네임 로드
  useEffect(() => {
    (async () => {
      if (!order || !user) return;
      const otherId = user.id === order.buyer_id ? order.seller_id : order.buyer_id;
      const { data } = await supabase
        .from("profiles")
        .select("nickname,email")
        .eq("id", otherId)
        .maybeSingle();
      setCounterpartyName(data?.nickname || data?.email?.split("@")[0] || "거래 상대");
    })();
  }, [order, user]);

  const send = async () => {
    if (!input.trim() || !user || !order || sending) return;
    const text = input.trim();
    setInput("");
    setSending(true);
    try {
      await sendMessage(order.id, user.id, text);
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

  const isBuyer = user?.id === order.buyer_id;
  const status = order.status;

  return (
    <PhoneShell hideTab>
      <AppHeader
        title={counterpartyName || "거래 채팅"}
        subtitle={`주문 #${order.id.slice(-4)} · ${STATUS_LABEL[status]}`}
        right={
          <Link
            to="/app/order/$orderId"
            params={{ orderId: order.id }}
            className="text-[12px] font-bold text-primary"
          >
            상세
          </Link>
        }
      />

      {/* 안전 안내 */}
      <div className="bg-warning-soft px-4 py-2 text-[11px] font-medium text-warning-foreground">
        <AlertTriangle className="mr-1 inline h-3 w-3" />
        외부 메신저 유도·계좌 변경 요청은 사기일 수 있어요. 모든 대화는 보존됩니다.
      </div>

      {/* 거래 상태 카드 */}
      <StatusCard status={status} isBuyer={isBuyer} />
      <ActionBar order={order} isBuyer={isBuyer} userId={user?.id} onOrderChange={refreshOrder} />

      {/* 채팅 본문 */}
      <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {msgLoading ? (
          <div className="flex justify-center py-8 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center text-[12px] text-muted-foreground py-8">
            아직 메시지가 없습니다. 첫 메시지를 보내보세요.
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div
                key={m.id}
                className={`flex ${mine ? "justify-end" : "justify-start"} anim-fade-up`}
              >
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[13px] ${
                    mine
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm bg-surface text-foreground"
                  }`}
                >
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                  <div
                    className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${
                      mine ? "text-white/70" : "text-muted-foreground"
                    }`}
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

      {/* 입력바 */}
      <div className="sticky bottom-0 z-10 border-t border-border bg-background px-3 py-2.5">
        <div className="flex items-center gap-2 rounded-full bg-surface px-3 py-2">
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
            className="flex-1 bg-transparent text-[13px] focus:outline-none disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </PhoneShell>
  );
}

function StatusCard({ status, isBuyer }: { status: string; isBuyer: boolean }) {
  if (status === "disputed") {
    return (
      <div className="mx-4 mt-3 rounded-xl border border-destructive bg-destructive-soft p-3">
        <div className="flex items-center gap-2 text-[12px] font-bold text-destructive">
          <ShieldAlert className="h-4 w-4" /> 분쟁이 진행 중입니다
        </div>
      </div>
    );
  }
  if (status === "completed" || status === "released") {
    return (
      <div className="mx-4 mt-3 rounded-xl border border-success bg-success-soft p-3 text-[12px] font-bold text-success">
        <Check className="mr-1 inline h-4 w-4" /> 거래가 완료되었습니다
      </div>
    );
  }
  if (status === "cancelled" || status === "expired") {
    return (
      <div className="mx-4 mt-3 rounded-xl bg-surface p-3 text-[12px] font-bold text-muted-foreground">
        주문이 종료되었습니다 ({STATUS_LABEL[status]})
      </div>
    );
  }
  const msg =
    status === "created" || status === "info_shared"
      ? isBuyer
        ? "판매자 계좌로 송금 후 ‘입금 완료’ 버튼을 눌러주세요."
        : "매수자의 송금을 기다리고 있어요."
      : status === "paid" || status === "proof_uploaded"
        ? isBuyer
          ? "판매자가 입금을 확인하고 코인을 릴리즈할 거예요."
          : "입금을 확인 후 코인을 릴리즈해 주세요."
        : "거래가 진행 중입니다.";
  return (
    <div className="mx-4 mt-3 rounded-xl border border-primary bg-primary-soft p-3 text-[12px] font-medium text-foreground">
      {msg}
    </div>
  );
}

/**
 * 채팅 내 액션바 — Binance P2P 방식의 수동 입금확인 + 온체인 릴리즈
 *  - Buyer (created/info_shared): "입금 완료 알림" → status='paid' + 시스템 메시지
 *  - Seller (paid/proof_uploaded): "입금 확인 + 코인 릴리즈"
 *      · 에스크로 락업 상태(escrow_status='locked')면 vault.release() 온체인 호출
 *        → 인덱서가 Released 이벤트 감지 후 DB 자동 업데이트
 *      · 락업 안 된 경우(테스트/직접거래)는 DB만 completed로
 *  - 양 당사자 (paid 이후): "분쟁 신청"
 */
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
}: {
  order: OrderRow;
  isBuyer: boolean;
  userId?: string;
  onOrderChange?: () => void | Promise<void>;
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
      await sysMsg("📢 입금 완료를 알렸습니다. 판매자가 확인 후 코인을 릴리즈합니다.");
      await onOrderChange?.();
      toast.success("입금 완료를 판매자에게 알렸습니다");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(null);
    }
  };

  const onSellerConfirmAndRelease = async () => {
    if (
      !confirm(
        "입금을 직접 확인하셨습니까?\n\n예금주명·금액을 통장에서 확인한 뒤 코인이 자동 릴리즈됩니다.\n오확인 시 분쟁이 접수될 수 있습니다.",
      )
    )
      return;
    setBusy("release");
    try {
      if (order.escrow_status === "locked" && order.chain) {
        // 온체인 릴리즈 — 인덱서가 DB 동기화
        const tx = await escrow.release(
          order.chain as "base" | "base-sepolia" | "polygon",
          order.id,
        );
        await sysMsg(`✅ 입금 확인 → 코인 릴리즈 트랜잭션 전송됨\nTx: ${tx.slice(0, 10)}...`);
        await onOrderChange?.();
        toast.success("릴리즈 트랜잭션 전송 완료. 블록 확인 후 자동 반영됩니다.");
      } else {
        // 에스크로 미사용 직접거래
        await releaseOrder(order.id);
        await sysMsg("✅ 입금 확인 완료. 거래가 종료되었습니다.");
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
    const reason = prompt("분쟁 사유를 입력해주세요 (예: 입금자명 불일치, 금액 부족 등)");
    if (!reason?.trim()) return;
    setBusy("dispute");
    try {
      await supabase.from("orders").update({ status: "disputed" }).eq("id", order.id);
      await supabase.from("disputes").insert({
        order_id: order.id,
        opener_id: userId!,
        reason: reason.trim(),
        status: "open",
      });
      await sysMsg(`⚠️ 분쟁이 접수되었습니다: ${reason.trim()}`);
      await onOrderChange?.();
      toast.success("분쟁이 접수되었습니다. 운영자가 검토합니다.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "분쟁 접수 실패");
    } finally {
      setBusy(null);
    }
  };

  // 종료된 주문은 액션 없음
  if (["completed", "released", "cancelled", "expired", "disputed"].includes(order.status))
    return null;

  const showBuyerPay = isBuyer && (order.status === "created" || order.status === "info_shared");
  const showSellerRel = !isBuyer && (order.status === "paid" || order.status === "proof_uploaded");
  const showDispute = order.status === "paid" || order.status === "proof_uploaded";

  if (!showBuyerPay && !showSellerRel && !showDispute) return null;

  return (
    <div className="mx-4 mt-2 flex flex-col gap-2">
      {showBuyerPay && (
        <button
          onClick={onBuyerMarkPaid}
          disabled={busy !== null}
          className="rounded-xl bg-primary py-3 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy === "paid" ? "처리 중…" : "💳 입금 완료 알리기"}
        </button>
      )}
      {showSellerRel && (
        <button
          onClick={onSellerConfirmAndRelease}
          disabled={busy !== null || escrow.busy}
          className="rounded-xl bg-success py-3 text-[13px] font-bold text-white disabled:opacity-50"
        >
          {busy === "release" || escrow.busy ? "릴리즈 중…" : "✅ 입금 확인 + 코인 릴리즈"}
        </button>
      )}
      {showDispute && (
        <button
          onClick={onDispute}
          disabled={busy !== null}
          className="rounded-xl border border-destructive bg-destructive-soft py-2.5 text-[12px] font-bold text-destructive disabled:opacity-50"
        >
          {busy === "dispute" ? "접수 중…" : "⚠️ 분쟁 신청"}
        </button>
      )}
      {showSellerRel && (
        <p className="text-[10.5px] leading-snug text-muted-foreground">
          ⚠️ 본인 통장에서 <b>입금자명·금액·시간</b>을 직접 확인하세요. 확인 후 릴리즈하면
          컨트랙트가 코인을 구매자에게 자동 전송합니다.
        </p>
      )}
    </div>
  );
}
