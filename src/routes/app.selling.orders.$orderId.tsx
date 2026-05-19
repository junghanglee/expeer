import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { OrderStatusStepper } from "@/components/espeer/OrderStatusStepper";
import { Section, InfoRow } from "@/components/espeer/Section";
import { BigNumber } from "@/components/espeer/BigNumber";
import { RiskBadge } from "@/components/espeer/Badges";
import { CopyableField } from "@/components/espeer/CopyableField";
import { MOCK_ORDERS, fmtKrw, fmtNum, type OrderStatus as MockOrderStatus } from "@/data/mock";
import type { Enums } from "@/integrations/supabase/types";
import { ArrowLeft, Check, X, MessageCircle, FileText, Lock } from "lucide-react";

// mock 대문자 enum → DB 소문자 enum 매핑
function mapMockStatus(s: MockOrderStatus): Enums<"order_status"> {
  switch (s) {
    case "ESCROW_PENDING":
      return "created";
    case "ESCROW_FUNDED":
      return "info_shared";
    case "PAYMENT_PENDING":
      return "paid";
    case "PAYMENT_MARKED":
      return "proof_uploaded";
    case "SELLER_REVIEWING":
      return "confirmed";
    case "RELEASED":
      return "released";
    case "CANCELLED":
      return "cancelled";
    case "EXPIRED":
      return "expired";
    case "DISPUTED":
      return "disputed";
    case "REFUNDED":
      return "cancelled";
    default:
      return "created";
  }
}

export const Route = createFileRoute("/app/selling/orders/$orderId")({
  loader: ({ params }) => {
    const order = MOCK_ORDERS.find((o) => o.id === params.orderId);
    if (!order) throw notFound();
    return { order };
  },
  head: () => ({ meta: [{ title: "수신 주문 — EXPEER" }] }),
  component: SellingOrderDetail,
});

function SellingOrderDetail() {
  const { order } = Route.useLoaderData();
  const dangerous = order.riskTier === "Review";

  return (
    <PhoneShell hideTab>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/app/selling"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-foreground">
              수신 주문 #{order.id.slice(-4)}
            </div>
            <div className="text-[10px] font-semibold text-muted-foreground">
              매수자: {order.buyerName}
            </div>
          </div>
        </div>
      </header>

      <OrderStatusStepper status={mapMockStatus(order.status)} />

      <div className="px-5">
        <BigNumber
          value={`${fmtNum(order.amountToken)}`}
          unit={order.asset}
          size="xl"
          caption={`받을 금액: ${fmtKrw(order.amountKrw)}`}
          tone={dangerous ? "danger" : "primary"}
        />
      </div>

      {/* On-chain escrow status */}
      <div className="mx-5 mt-3 rounded-2xl border border-primary-soft bg-primary-soft/60 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-primary">
            <Lock className="h-3.5 w-3.5" /> 온체인 에스크로 상태
          </div>
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
            락업 완료
          </span>
        </div>
        <div className="mt-2 text-[11px] leading-relaxed text-foreground/80">
          내 지갑에서{" "}
          <b>
            {fmtNum(order.amountToken)} {order.asset}
          </b>
          가 컨트랙트에 일시 락업되어 있어요. 입금 검증 후 P2P 서명으로만 매수자에게 전송됩니다.
        </div>
        <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">
          tx: {order.txHash ?? "0xabc12…lock"}
        </div>
      </div>

      <Section title="리스크 평가" action={<RiskBadge tier={order.riskTier} />}>
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="text-[12px] text-muted-foreground">리스크 점수</div>
            <div
              className={`num-display text-xl ${dangerous ? "text-destructive" : "text-success"}`}
            >
              {order.riskScore}/100
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
            <div
              className={`h-full rounded-full ${dangerous ? "bg-destructive" : "bg-success"}`}
              style={{ width: `${order.riskScore}%` }}
            />
          </div>
          <ul className="mt-4 space-y-1.5">
            {order.riskSignals.map((s: { label: string; ok: boolean }) => (
              <li key={s.label} className="flex items-center gap-2 text-[13px]">
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full ${
                    s.ok ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
                  }`}
                >
                  {s.ok ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                </span>
                <span className={s.ok ? "text-foreground" : "font-semibold text-destructive"}>
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section title="매수자 송금 정보">
        <div className="rounded-2xl border border-border bg-card px-4 py-1">
          <InfoRow
            label="송금 계좌"
            value={`${order.buyerAccount.bank} ${order.buyerAccount.number}`}
          />
          <div className="h-px bg-border" />
          <InfoRow
            label="예금주"
            value={order.buyerAccount.holder}
            tone={dangerous ? "danger" : "default"}
          />
        </div>
      </Section>

      <Section title="내 수취 계좌">
        <CopyableField
          label={order.sellerAccount.bank}
          value={`${order.sellerAccount.number} (${order.sellerAccount.holder})`}
        />
      </Section>

      <Section>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/app/order/$orderId/chat"
            params={{ orderId: order.id }}
            search={{ role: "seller" }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-[13px] font-bold text-foreground"
          >
            <MessageCircle className="h-4 w-4" /> 채팅
          </Link>
          <Link
            to="/app/order/$orderId/proof"
            params={{ orderId: order.id }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-[13px] font-bold text-foreground"
          >
            <FileText className="h-4 w-4" /> 입금증 보기
          </Link>
        </div>
      </Section>

      <div className="h-24" />
      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        {dangerous ? (
          <Link
            to="/app/order/$orderId"
            params={{ orderId: order.id }}
            search={{ status: "DISPUTED" }}
            className="block rounded-xl bg-destructive py-3.5 text-center text-[15px] font-bold text-destructive-foreground"
          >
            분쟁으로 전환
          </Link>
        ) : (
          <Link
            to="/app/order/$orderId"
            params={{ orderId: order.id }}
            search={{ status: "RELEASED" }}
            className="block rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground"
          >
            P2P 서명 · 코인 릴리즈
          </Link>
        )}
        <p className="mt-1 text-center text-[10px] text-muted-foreground">
          릴리즈는 내 지갑 서명으로만 가능 · 플랫폼은 자산을 옮길 수 없습니다
        </p>
      </div>
    </PhoneShell>
  );
}
