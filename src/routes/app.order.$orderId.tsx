import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { CheckCircle2, FileText, Loader2, MessageCircle, ShieldAlert, Star } from "lucide-react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Section } from "@/components/espeer/Section";
import { BigNumber } from "@/components/espeer/BigNumber";
import { CountdownTimer } from "@/components/espeer/CountdownTimer";
import { OrderStatusStepper } from "@/components/espeer/OrderStatusStepper";
import { CounterpartyTrustCard } from "@/components/espeer/CounterpartyTrustCard";
import {
  cancelOrder,
  markOrderPaid,
  requestCancel,
  useOrder,
  withdrawCancelRequest,
} from "@/hooks/useOrders";
import { useAuth } from "@/lib/auth";
import { useOrderReviews } from "@/hooks/useReviews";
import { toast } from "sonner";
import { useState } from "react";

const STATUS_LABEL: Record<string, string> = {
  created: "대기 중",
  info_shared: "정보 공유",
  paid: "입금/전송 완료",
  proof_uploaded: "증빙 제출",
  confirmed: "확인 중",
  released: "릴리즈 완료",
  completed: "거래 완료",
  cancelled: "취소됨",
  disputed: "분쟁 중",
  expired: "만료됨",
};

export const Route = createFileRoute("/app/order/$orderId")({
  head: () => ({ meta: [{ title: "주문 상세 — EXPEER" }] }),
  component: OrderDetail,
});

function OrderDetail() {
  const { orderId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();
  const { user } = useAuth();
  const { order, loading, refresh } = useOrder(orderId);
  const { myReview } = useOrderReviews(order?.status === "completed" ? order.id : undefined);
  const [busy, setBusy] = useState(false);

  if (loading) {
    return (
      <PhoneShell hideTab>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      </PhoneShell>
    );
  }

  if (!order) {
    return (
      <PhoneShell hideTab>
        <AppHeader title="주문 없음" />
        <div className="px-5 py-8 text-center text-muted-foreground">존재하지 않는 주문입니다.</div>
      </PhoneShell>
    );
  }

  if (pathname !== `/app/order/${order.id}`) return <Outlet />;

  const isDemo = order.id.startsWith("demo-order-");
  const isBuyer = isDemo || user?.id === order.buyer_id;
  const isSeller = user?.id === order.seller_id;
  const isCryptoSwap = order.ads?.kind === "crypto_swap";
  const counterpartId = isBuyer ? order.seller_id : isSeller ? order.buyer_id : undefined;
  const status = order.status;
  const remainSec = Math.max(
    0,
    Math.floor((new Date(order.expires_at).getTime() - Date.now()) / 1000),
  );
  const receiveAsset = isCryptoSwap ? order.ads?.to_asset : order.fiat;
  const receiveAmount = isCryptoSwap
    ? Number(order.ads?.to_amount ?? order.fiat_amount)
    : Number(order.fiat_amount);
  const myCancelRequested = isBuyer
    ? order.buyer_cancel_requested_at
    : order.seller_cancel_requested_at;

  const run = async (fn: () => Promise<void>, ok: string) => {
    if (isDemo) {
      toast.success("테스트 주문에서는 화면 흐름만 확인합니다.");
      return;
    }
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "처리 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader
        title={`주문 #${order.id.slice(-4)}`}
        subtitle={`${isCryptoSwap ? "P2P교환" : "P2P환전"} · ${STATUS_LABEL[status] ?? status}`}
      />
      <OrderStatusStepper status={status} />

      {isDemo && (
        <div className="px-5 pt-3">
          <div className="rounded-2xl border border-success bg-success-soft p-3 text-[12px] font-semibold leading-relaxed text-success">
            테스트 주문입니다. 실제 DB 저장 없이 상세·채팅·증빙·분쟁 흐름을 확인할 수 있습니다.
          </div>
        </div>
      )}

      <div className="px-5 pt-3">
        <BigNumber
          value={Number(order.amount).toLocaleString("ko-KR", { maximumFractionDigits: 6 })}
          unit={order.asset}
          size="xl"
          tone="primary"
          caption={
            isCryptoSwap
              ? `받을 수량 ${receiveAmount.toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ${receiveAsset} · ${order.network}`
              : `${Number(order.fiat_amount).toLocaleString("ko-KR")} ${order.fiat} · ${order.network}`
          }
        />
      </div>

      <NextActionCard
        status={status}
        isBuyer={isBuyer}
        isSeller={isSeller}
        asset={order.asset}
        fiat={order.fiat}
        fiatAmount={Number(order.fiat_amount)}
        remainSec={remainSec}
        isCryptoSwap={isCryptoSwap}
        receiveAsset={receiveAsset ?? order.fiat}
        receiveAmount={receiveAmount}
      />

      <CounterpartyTrustCard userId={counterpartId} />

      <Section title="수수료 안내">
        <div className="rounded-2xl border border-border bg-card p-3 text-[12px]">
          <FeeRow
            label={`참여자 수수료 (${Number(order.buyer_fee_pct)}%)`}
            value={`${((Number(order.amount) * Number(order.buyer_fee_pct)) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ${order.asset}`}
            highlight={isBuyer}
          />
          <FeeRow
            label={`오퍼 등록자 수수료 (${Number(order.seller_fee_pct)}%)`}
            value={`${((Number(order.amount) * Number(order.seller_fee_pct)) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ${order.asset}`}
            highlight={isSeller}
          />
          <div className="mt-2 rounded-lg bg-surface px-2 py-1.5 text-[11px] font-semibold leading-relaxed text-muted-foreground">
            EXPEER는 현금과 코인을 보관하지 않습니다. 수수료는 거래 코인 기준으로 계산됩니다.
          </div>
        </div>
      </Section>

      {status === "disputed" && (
        <Section>
          <div className="rounded-2xl border border-destructive bg-destructive-soft p-4">
            <div className="flex items-center gap-2 text-[14px] font-extrabold text-destructive">
              <ShieldAlert className="h-5 w-5" /> 분쟁/자료 보존 진행 중
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-foreground">
              채팅, 증빙, 주문 기록을 보존하고 제출용 자료를 준비합니다.
            </p>
          </div>
        </Section>
      )}

      {(status === "completed" || status === "released") && (
        <Section>
          <div className="rounded-2xl border border-success bg-success-soft p-5 text-center text-[15px] font-extrabold text-foreground">
            거래가 완료되었습니다.
          </div>
          {status === "completed" && (isBuyer || isSeller) && (
            <Link
              to="/app/order/$orderId/review"
              params={{ orderId }}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-warning bg-warning-soft py-3 text-[13px] font-bold text-warning-foreground"
            >
              <Star className={`h-4 w-4 ${myReview ? "fill-warning text-warning" : ""}`} />
              {myReview ? "내가 남긴 평가 보기" : "상대방 평가 남기기"}
            </Link>
          )}
        </Section>
      )}

      {(order.buyer_cancel_requested_at || order.seller_cancel_requested_at) &&
        status !== "cancelled" && (
          <Section>
            <div className="rounded-2xl border border-warning bg-warning-soft p-4 text-[13px] text-foreground">
              <div className="font-bold">취소 합의 진행 중</div>
              <div className="mt-2 text-[12px]">
                구매자 동의: {order.buyer_cancel_requested_at ? "완료" : "대기"} · 판매자 동의:{" "}
                {order.seller_cancel_requested_at ? "완료" : "대기"}
              </div>
            </div>
          </Section>
        )}

      <Section>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/app/order/$orderId/proof"
            params={{ orderId }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-[13px] font-bold text-foreground"
          >
            <FileText className="h-4 w-4" /> 증빙
          </Link>
          <Link
            to="/app/order/$orderId/chat"
            params={{ orderId }}
            search={{ role: isBuyer ? "buyer" : "seller" }}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-3 text-[13px] font-bold text-foreground"
          >
            <MessageCircle className="h-4 w-4" /> 채팅
          </Link>
        </div>
      </Section>

      <div className="h-24" />
      <div className="sticky bottom-0 z-10 space-y-2 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        {isBuyer && (status === "created" || status === "info_shared") && (
          <button
            disabled={busy}
            onClick={() =>
              run(
                () => markOrderPaid(order.id),
                isCryptoSwap ? "전송 준비 완료 처리" : "입금 완료 처리",
              )
            }
            className="block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {isCryptoSwap ? "전송 준비 완료 표시" : "입금 완료 표시"}
          </button>
        )}
        {(status === "created" || status === "info_shared") && (isBuyer || isSeller) && (
          <button
            disabled={busy}
            onClick={() => run(() => cancelOrder(order.id), "주문 취소됨")}
            className="block w-full rounded-xl border border-border bg-card py-2.5 text-center text-[13px] font-semibold text-muted-foreground"
          >
            주문 취소
          </button>
        )}
        {(status === "paid" || status === "proof_uploaded" || status === "confirmed") &&
          (isBuyer || isSeller) &&
          (myCancelRequested ? (
            <button
              disabled={busy}
              onClick={() =>
                run(
                  () => withdrawCancelRequest(order.id, isBuyer ? "buyer" : "seller"),
                  "취소 요청을 철회했습니다",
                )
              }
              className="block w-full rounded-xl border border-border bg-card py-2.5 text-center text-[13px] font-semibold text-muted-foreground"
            >
              취소 요청 철회
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() =>
                run(
                  () => requestCancel(order.id, isBuyer ? "buyer" : "seller"),
                  "취소 요청을 보냈습니다",
                )
              }
              className="block w-full rounded-xl border border-warning bg-warning-soft py-2.5 text-center text-[13px] font-semibold text-warning-foreground"
            >
              상대방에게 취소 합의 요청
            </button>
          ))}
        {(status === "paid" || status === "proof_uploaded" || isDemo) && (
          <Link
            to="/app/order/$orderId/dispute"
            params={{ orderId }}
            className="block text-center text-[12px] font-semibold text-destructive"
          >
            문제가 있나요? 자료 보존 신청
          </Link>
        )}
        {["completed", "released", "cancelled", "expired"].includes(status) && (
          <button
            onClick={() => navigate({ to: "/app/orders" })}
            className="block w-full rounded-xl bg-surface py-3 text-center text-[13px] font-bold text-foreground"
          >
            주문 내역으로
          </button>
        )}
      </div>
    </PhoneShell>
  );
}

function NextActionCard({
  status,
  isBuyer,
  isSeller,
  asset,
  fiat,
  fiatAmount,
  remainSec,
  isCryptoSwap,
  receiveAsset,
  receiveAmount,
}: {
  status: string;
  isBuyer: boolean;
  isSeller: boolean;
  asset: string;
  fiat: string;
  fiatAmount: number;
  remainSec: number;
  isCryptoSwap: boolean;
  receiveAsset: string;
  receiveAmount: number;
}) {
  const receiveText = isCryptoSwap
    ? `${receiveAmount.toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ${receiveAsset}`
    : `${fiatAmount.toLocaleString("ko-KR")} ${fiat}`;
  let title = isCryptoSwap ? "교환 조건 확인" : "거래 상태 확인";
  let desc = isCryptoSwap
    ? `${asset}를 전송하고 ${receiveText}를 받는 교환 주문입니다.`
    : "거래 내용을 확인하고 다음 단계를 진행해 주세요.";
  let items = isCryptoSwap
    ? ["양측 지갑 주소 확인", "전송/수령 조건 확인", "문제 발생 시 증빙 보존"]
    : ["거래 내용 확인", "상대방 상태 확인"];

  if (!isCryptoSwap && isBuyer && (status === "created" || status === "info_shared")) {
    title = "지금 해야 할 일: 입금하기";
    desc = `${receiveText}를 판매자 계좌로 보낸 뒤 입금 완료 버튼을 눌러주세요.`;
    items = ["입금 계좌와 예금주 확인", "본인 명의 계좌로 송금", "입금 완료 버튼 누르기"];
  } else if (!isCryptoSwap && isSeller && (status === "created" || status === "info_shared")) {
    title = "구매자 입금 대기";
    desc = `구매자의 입금 완료 표시를 기다리고 ${asset} 릴리즈 준비 상태를 확인하세요.`;
    items = ["코인 보유 상태 확인", "구매자 입금 알림 대기", "채팅 요청 확인"];
  } else if (!isCryptoSwap && status === "paid") {
    title = isBuyer ? "판매자가 입금을 확인 중" : "입금 확인 필요";
    desc = isBuyer
      ? "판매자가 입금 내역을 확인한 뒤 코인을 릴리즈합니다."
      : "입금자명과 금액을 확인한 뒤 코인을 릴리즈해 주세요.";
    items = isBuyer
      ? ["채팅 알림 확인", "증빙 보존", "판매자 확인 대기"]
      : ["입금자명 확인", "금액 확인", "코인 릴리즈"];
  } else if (status === "disputed") {
    title = "자료 보존 상태";
    desc = "거래 자료를 보존하고 제출용 증빙을 준비합니다.";
    items = ["거래 자료 다운로드", "채팅·증빙 확인", "은행·수사기관 제출 준비"];
  } else if (status === "released" || status === "completed") {
    title = "거래 완료";
    desc = "거래가 완료되었습니다. 평가를 남기면 다음 거래에 도움이 됩니다.";
    items = ["수령/지급 내역 확인", "상대방 평가", "피드백 반영"];
  }

  return (
    <Section
      title="지금 해야 할 일"
      action={remainSec > 0 && !isCryptoSwap ? <CountdownTimer totalSec={remainSec} /> : undefined}
    >
      <div className="rounded-2xl border border-primary bg-primary-soft p-4">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[14px] font-extrabold text-foreground">{title}</div>
            <p className="mt-1 text-[12px] leading-relaxed text-foreground/75">{desc}</p>
          </div>
        </div>
        <div className="mt-3 grid gap-1.5">
          {items.map((item) => (
            <div
              key={item}
              className="flex items-center gap-2 rounded-lg bg-background/70 px-2 py-1.5 text-[11px] font-semibold text-foreground/80"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function FeeRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between py-1 ${highlight ? "font-bold text-foreground" : "text-muted-foreground"}`}
    >
      <span>
        {label}
        {highlight && (
          <span className="ml-1 rounded bg-primary-soft px-1 text-[10px] text-primary">
            내 부담
          </span>
        )}
      </span>
      <span className="num-display">{value}</span>
    </div>
  );
}
