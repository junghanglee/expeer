import { createFileRoute, Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { OrderStatusStepper } from "@/components/espeer/OrderStatusStepper";
import { CountdownTimer } from "@/components/espeer/CountdownTimer";
import { CopyableField } from "@/components/espeer/CopyableField";
import { BigNumber } from "@/components/espeer/BigNumber";
import { Section } from "@/components/espeer/Section";
import {
  Loader2,
  MessageCircle,
  FileText,
  ShieldAlert,
  Check,
  Star,
  CheckCircle2,
} from "lucide-react";
import {
  useOrder,
  markOrderPaid,
  cancelOrder,
  requestCancel,
  withdrawCancelRequest,
} from "@/hooks/useOrders";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useOrderReviews } from "@/hooks/useReviews";
import { EscrowPanel } from "@/components/espeer/EscrowPanel";
import { networkToChain, type SupportedChain } from "@/lib/escrow";
import { toast } from "sonner";
import { useEvidencePackage as useEvidencePackageHook } from "@/hooks/useEvidencePackage";
import { CounterpartyTrustCard } from "@/components/espeer/CounterpartyTrustCard";

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

export const Route = createFileRoute("/app/order/$orderId")({
  head: () => ({ meta: [{ title: "주문 상세 — EXPEER" }] }),
  component: OrderDetail,
});

interface BankInfo {
  role: "seller" | "buyer";
  bank_name: string;
  account_number: string;
  account_holder: string;
}

function OrderDetail() {
  const { orderId } = Route.useParams();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { order, loading, refresh } = useOrder(orderId);
  const [sellerBank, setSellerBank] = useState<BankInfo | null>(null);
  const [buyerBank, setBuyerBank] = useState<BankInfo | null>(null);
  const [bankLoadError, setBankLoadError] = useState(false);
  const [buyerWalletAddress, setBuyerWalletAddress] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // CRITICAL: hooks must be called unconditionally (before any early return)
  const { myReview } = useOrderReviews(order?.status === "completed" ? order.id : undefined);

  useEffect(() => {
    (async () => {
      if (!order) return;
      setSellerBank(null);
      setBuyerBank(null);
      setBankLoadError(false);
      setBuyerWalletAddress(null);

      const { data: bankRows, error: bankError } = await supabase.rpc("get_order_bank_accounts", {
        _order_id: order.id,
      });
      if (bankError) {
        setBankLoadError(true);
      } else {
        setSellerBank(bankRows?.find((row) => row.role === "seller") ?? null);
        setBuyerBank(bankRows?.find((row) => row.role === "buyer") ?? null);
      }

      if (order.buyer_wallet_id) {
        const { data } = await supabase
          .from("wallets")
          .select("address")
          .eq("id", order.buyer_wallet_id)
          .maybeSingle();
        setBuyerWalletAddress(data?.address ?? null);
      }
    })();
  }, [order]);

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

  // Child routes such as /app/order/$orderId/chat must render their own screen.
  if (pathname !== `/app/order/${order.id}`) {
    return <Outlet />;
  }

  const isBuyer = user?.id === order.buyer_id;
  const isSeller = user?.id === order.seller_id;
  const counterpartId = isBuyer ? order.seller_id : isSeller ? order.buyer_id : undefined;
  const status = order.status;
  const escrowChain: SupportedChain | null =
    (order.chain as SupportedChain | null) ?? networkToChain(order.network);
  const expiresMs = new Date(order.expires_at).getTime() - Date.now();
  const remainSec = Math.max(0, Math.floor(expiresMs / 1000));

  const doPaid = async () => {
    setBusy(true);
    try {
      await markOrderPaid(order.id);
      toast.success("입금 완료 처리됨");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };
  // 릴리즈는 EscrowPanel(온체인)로만 수행. DB는 recordEscrowRelease가 갱신.

  const doCancel = async () => {
    setBusy(true);
    try {
      await cancelOrder(order.id);
      toast.success("주문 취소됨");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const doRequestCancel = async () => {
    if (!isBuyer && !isSeller) return;
    setBusy(true);
    try {
      await requestCancel(order.id, isBuyer ? "buyer" : "seller");
      toast.success("취소 요청을 상대에게 보냈어요");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  const doWithdrawCancel = async () => {
    if (!isBuyer && !isSeller) return;
    setBusy(true);
    try {
      await withdrawCancelRequest(order.id, isBuyer ? "buyer" : "seller");
      toast.success("취소 요청을 철회했어요");
      refresh();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "오류");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader title={`주문 #${order.id.slice(-4)}`} subtitle={STATUS_LABEL[status]} />
      <OrderStatusStepper status={status} />

      <div className="px-5">
        <BigNumber
          value={`${Number(order.amount).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}`}
          unit={order.asset}
          size="xl"
          tone="primary"
          caption={`${Number(order.fiat_amount).toLocaleString("ko-KR")} ${order.fiat} · ${order.network}`}
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
      />

      <CounterpartyTrustCard userId={counterpartId} />

      {/* 수수료 내역 */}
      <Section title="수수료 내역">
        <div className="rounded-2xl border border-border bg-card p-3 text-[12px]">
          <FeeRow
            label={`매수자 수수료 (${Number(order.buyer_fee_pct)}%)`}
            value={`${((Number(order.amount) * Number(order.buyer_fee_pct)) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ${order.asset}`}
            highlight={isBuyer}
          />
          <FeeRow
            label={`매도자 수수료 (${Number(order.seller_fee_pct)}%)`}
            value={`${((Number(order.amount) * Number(order.seller_fee_pct)) / 100).toLocaleString("ko-KR", { maximumFractionDigits: 6 })} ${order.asset}`}
            highlight={isSeller}
          />
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-[11px] font-bold text-foreground">
            <span>거래 수량</span>
            <span className="num-display">
              {Number(order.amount).toLocaleString("ko-KR", { maximumFractionDigits: 4 })}{" "}
              {order.asset}
            </span>
          </div>
          <div className="mt-2 rounded-lg bg-surface px-2 py-1.5 text-[11px] font-semibold leading-relaxed text-muted-foreground">
            EXPEER 수수료는 현금이 아니라 거래 코인 기준으로 계산됩니다. 플랫폼은 현금과 코인을
            보관하지 않습니다.
          </div>
        </div>
      </Section>

      {/* 송금 정보 — 매수자 */}
      {isBuyer && (status === "created" || status === "info_shared") && sellerBank && (
        <Section
          title="이 계좌로 송금해 주세요"
          action={remainSec > 0 ? <CountdownTimer totalSec={remainSec} /> : undefined}
        >
          <div className="rounded-2xl border border-primary bg-primary-soft p-4">
            <div className="space-y-2">
              <CopyableField label="은행" value={sellerBank.bank_name} mono={false} />
              <CopyableField label="계좌번호" value={sellerBank.account_number} big />
              <CopyableField label="예금주" value={sellerBank.account_holder} mono={false} />
              <CopyableField
                label="입금 금액"
                value={`${Number(order.fiat_amount).toLocaleString("ko-KR")} ${order.fiat}`}
                big
              />
            </div>
          </div>
          {buyerBank && (
            <div className="mt-3 rounded-xl bg-warning-soft px-3 py-2 text-[12px] font-medium text-warning-foreground">
              반드시{" "}
              <b>
                {buyerBank.bank_name} {buyerBank.account_number}
              </b>{" "}
              ({buyerBank.account_holder}) 계좌에서 송금해 주세요.
            </div>
          )}
        </Section>
      )}

      {isBuyer && (status === "created" || status === "info_shared") && !sellerBank && (
        <Section title="이 계좌로 송금해 주세요">
          <div className="rounded-2xl border border-warning/40 bg-warning-soft px-4 py-3 text-[12px] font-semibold leading-relaxed text-warning-foreground">
            {bankLoadError
              ? "판매자 계좌 조회 RPC가 아직 Supabase에 적용되지 않았어요. manual-fixes SQL을 적용하면 계좌번호가 표시됩니다."
              : "판매자 계좌 정보를 불러오는 중입니다."}
          </div>
        </Section>
      )}

      {/* 매도자 안내 */}
      {isSeller && (status === "created" || status === "info_shared") && (
        <Section>
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <Loader2 className="mx-auto h-7 w-7 animate-spin text-primary" />
            <div className="mt-3 text-[14px] font-bold text-foreground">매수자 송금 대기 중</div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              매수자가 입금을 완료하면 알림이 도착합니다.
            </div>
          </div>
        </Section>
      )}

      {(status === "paid" || status === "proof_uploaded" || status === "confirmed") && (
        <Section>
          <div className="rounded-2xl border border-border bg-card p-6 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
              <span className="h-3 w-3 rounded-full bg-primary pulse-dot" />
            </div>
            <div className="mt-3 text-[15px] font-bold text-foreground">
              {isSeller ? "입금을 확인해 주세요" : "판매자가 입금을 확인 중이에요"}
            </div>
            <div className="mt-1 text-[12px] text-muted-foreground">
              확인 후 코인이 자동으로 매수자 지갑으로 전송됩니다.
            </div>
          </div>
        </Section>
      )}

      {/* 온체인 에스크로 패널 — 판매자에게만 노출 (lock/release/refund 컨트롤) */}
      {isSeller &&
        escrowChain &&
        buyerWalletAddress &&
        status !== "completed" &&
        status !== "cancelled" &&
        status !== "expired" && (
          <Section title="온체인 에스크로">
            <EscrowPanel
              orderId={order.id}
              chain={escrowChain}
              asset={order.asset}
              amount={Number(order.amount)}
              buyerWallet={buyerWalletAddress}
              escrowStatus={order.escrow_status}
              lockTxHash={order.escrow_lock_tx_hash}
              releaseTxHash={order.escrow_release_tx_hash}
              expiresAt={order.expires_at}
              onChange={refresh}
            />
          </Section>
        )}
      {isSeller &&
        (!escrowChain || !buyerWalletAddress) &&
        status !== "completed" &&
        status !== "cancelled" && (
          <Section title="온체인 에스크로">
            <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-[12px] text-warning-foreground">
              {!escrowChain && (
                <p>
                  이 주문의 네트워크({order.network})는 아직 온체인 에스크로를 지원하지 않습니다.
                </p>
              )}
              {escrowChain && !buyerWalletAddress && (
                <p>매수자 지갑 주소가 등록되지 않아 락업할 수 없습니다.</p>
              )}
            </div>
          </Section>
        )}

      {(status === "released" || status === "completed") && (
        <Section>
          <div className="rounded-2xl border border-success bg-success-soft p-6 text-center anim-scale-in">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground">
              <Check className="h-8 w-8" strokeWidth={3} />
            </div>
            <div className="mt-3 text-[16px] font-extrabold text-foreground">
              거래가 완료되었어요
            </div>
          </div>
          {status === "completed" && (isBuyer || isSeller) && (
            <Link
              to="/app/order/$orderId/review"
              params={{ orderId }}
              className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-warning bg-warning-soft py-3 text-[13px] font-bold text-warning-foreground"
            >
              <Star className={`h-4 w-4 ${myReview ? "fill-warning text-warning" : ""}`} />
              {myReview ? "내가 남긴 평가 보기" : `${isBuyer ? "판매자" : "매수자"} 평가 작성`}
            </Link>
          )}
        </Section>
      )}

      {status === "disputed" && (
        <Section>
          <DisputedNotice orderId={order.id} />
        </Section>
      )}

      {/* 양측 취소 합의 진행 상태 */}
      {(order.buyer_cancel_requested_at || order.seller_cancel_requested_at) &&
        status !== "cancelled" && (
          <Section>
            <div className="rounded-2xl border border-warning bg-warning-soft p-4 text-[13px] text-foreground">
              <div className="font-bold">취소 합의 진행 중</div>
              <ul className="mt-2 space-y-1 text-[12px]">
                <li>매수자 동의: {order.buyer_cancel_requested_at ? "✓ 완료" : "대기"}</li>
                <li>매도자 동의: {order.seller_cancel_requested_at ? "✓ 완료" : "대기"}</li>
              </ul>
              <div className="mt-2 text-[11px] text-muted-foreground">
                양측 모두 동의하면 자동으로 취소됩니다.
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
            <FileText className="h-4 w-4" /> 입금증
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
            onClick={doPaid}
            className="block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground disabled:opacity-50"
          >
            입금 완료 표시
          </button>
        )}
        {isSeller &&
          (status === "paid" || status === "proof_uploaded" || status === "confirmed") && (
            <div className="rounded-xl bg-primary-soft px-3 py-2.5 text-center text-[12px] font-semibold text-primary">
              ⬆ 위 「온체인 에스크로」 패널에서 “구매자에게 지급” 버튼으로 릴리즈하세요
            </div>
          )}
        {(status === "created" || status === "info_shared") && (isBuyer || isSeller) && (
          <button
            disabled={busy}
            onClick={doCancel}
            className="block w-full rounded-xl border border-border bg-card py-2.5 text-center text-[13px] font-semibold text-muted-foreground"
          >
            주문 취소 (입금 전)
          </button>
        )}
        {(status === "paid" || status === "proof_uploaded" || status === "confirmed") &&
          (isBuyer || isSeller) &&
          (() => {
            const myReq = isBuyer
              ? order.buyer_cancel_requested_at
              : order.seller_cancel_requested_at;
            return myReq ? (
              <button
                disabled={busy}
                onClick={doWithdrawCancel}
                className="block w-full rounded-xl border border-border bg-card py-2.5 text-center text-[13px] font-semibold text-muted-foreground"
              >
                취소 요청 철회
              </button>
            ) : (
              <button
                disabled={busy}
                onClick={doRequestCancel}
                className="block w-full rounded-xl border border-warning bg-warning-soft py-2.5 text-center text-[13px] font-semibold text-warning-foreground"
              >
                상대에게 취소 합의 요청
              </button>
            );
          })()}
        {(status === "completed" ||
          status === "released" ||
          status === "cancelled" ||
          status === "expired") && (
          <button
            onClick={() => navigate({ to: "/app/orders" })}
            className="block w-full rounded-xl bg-surface py-3 text-center text-[13px] font-bold text-foreground"
          >
            주문 내역으로
          </button>
        )}
        {(status === "created" ||
          status === "info_shared" ||
          status === "paid" ||
          status === "proof_uploaded") && (
          <Link
            to="/app/order/$orderId/dispute"
            params={{ orderId }}
            className="block text-center text-[12px] font-semibold text-destructive"
          >
            문제가 있나요? 분쟁 신청
          </Link>
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
}: {
  status: string;
  isBuyer: boolean;
  isSeller: boolean;
  asset: string;
  fiat: string;
  fiatAmount: number;
  remainSec: number;
}) {
  let title = "거래 상태 확인";
  let desc = "아래 거래 정보와 채팅을 확인해 주세요.";
  let items = ["거래 내용 확인", "상대방 안내 확인"];

  if (isBuyer && (status === "created" || status === "info_shared")) {
    title = "지금 해야 할 일: 입금하기";
    desc = `${fiatAmount.toLocaleString("ko-KR")} ${fiat}를 판매자 계좌로 보낸 뒤, 아래의 입금 완료 버튼을 누르세요.`;
    items = ["입금 계좌와 예금주 확인", "본인 명의 계좌로 송금", "입금 완료 버튼 누르기"];
  } else if (isSeller && (status === "created" || status === "info_shared")) {
    title = "지금 해야 할 일: 구매자 입금 대기";
    desc = `구매자가 입금 완료를 누를 때까지 기다리세요. ${asset}는 에스크로 상태를 먼저 확인해야 합니다.`;
    items = ["코인 락업 상태 확인", "구매자 입금 알림 대기", "채팅 요청 확인"];
  } else if (
    isSeller &&
    (status === "paid" || status === "proof_uploaded" || status === "confirmed")
  ) {
    title = "지금 해야 할 일: 입금 확인";
    desc =
      "은행 앱에서 실제 입금자명과 금액을 확인한 뒤, 온체인 에스크로에서 구매자에게 지급하세요.";
    items = ["은행 앱에서 입금 확인", "입금자명/금액 일치 확인", "구매자에게 코인 지급"];
  } else if (
    isBuyer &&
    (status === "paid" || status === "proof_uploaded" || status === "confirmed")
  ) {
    title = "지금 해야 할 일: 판매자 확인 대기";
    desc = "판매자가 입금 내역을 확인 중입니다. 문제가 있으면 채팅 또는 분쟁 신청을 이용하세요.";
    items = ["채팅 알림 확인", "입금증 보관", "필요 시 분쟁 신청"];
  } else if (status === "disputed") {
    title = "자료 보존 상태";
    desc = "필요하면 제출용 거래 자료를 다운로드하고, 채팅/입금증/온체인 기록을 보존하세요.";
    items = ["제출용 자료 다운로드", "채팅·입금증 확인", "은행/수사기관 제출 준비"];
  } else if (status === "released" || status === "completed") {
    title = "거래 완료";
    desc = "거래가 완료되었습니다. 상대방 평가를 남기면 다음 거래자의 판단에 도움이 됩니다.";
    items = ["수령/지급 내역 확인", "상대방 평가", "평판 반영"];
  }

  return (
    <Section
      title="지금 해야 할 일"
      action={remainSec > 0 ? <CountdownTimer totalSec={remainSec} /> : undefined}
    >
      <div className="rounded-2xl border border-primary bg-primary-soft p-4">
        <div className="flex items-start gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div className="min-w-0">
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

function DisputedNotice({ orderId }: { orderId: string }) {
  const { download, loading } = useEvidencePackageHook();
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-destructive bg-destructive-soft p-5">
        <div className="flex items-center gap-2 text-[14px] font-extrabold text-destructive">
          <ShieldAlert className="h-5 w-5" /> 분쟁(자료 보존) 진행 중
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-foreground">
          EXPEER는 비수탁 P2P 중개 플랫폼으로, 분쟁을 직접 중재·판정하지 않습니다. 1차 해결 책임은
          거래 당사자에게 있으며, EXPEER는 보존된 자료를 제공하는 역할만 수행합니다.
        </p>
      </div>

      <div className="rounded-2xl border border-warning bg-warning-soft p-4 text-[12px] leading-relaxed text-foreground">
        <div className="font-extrabold text-warning">예외 — arbiter 최후수단 안내</div>
        <p className="mt-1">
          판매자가 입금을 명시적으로 확인했음에도 부당하게 코인 지급을 거부한 경우에 한해, 보존된
          자료에 근거하여 EXPEER가 운영하는 멀티시그(arbiter)가 컨트랙트 자금을 정산할 수 있습니다.
          이는 자동 보장이 아니며, 입금자명·금액·채팅 기록·온체인 이벤트가 일관되게 입증될 때만
          적용됩니다.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 text-[12px] text-foreground">
        <div className="font-bold">제출용 자료에 포함되는 항목</div>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>• POLICY.txt — EXPEER 분쟁 처리 정책</li>
          <li>• summary.json — 주문/당사자 요약 (개인정보 마스킹)</li>
          <li>• chat.txt / messages.json — 채팅 로그 전체</li>
          <li>• payment_proofs.json — 송금 증빙 메타데이터</li>
          <li>• transfers.json — 온체인 이체 내역</li>
          <li>• chain_events.json — 에스크로 컨트랙트 트랜잭션 해시</li>
          <li>• disputes.json — 자료 보존 신청 이력</li>
        </ul>
        <button
          onClick={() => download(orderId)}
          disabled={loading}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft py-2.5 text-[12px] font-bold text-primary disabled:opacity-50"
        >
          <FileText className="h-4 w-4" />
          {loading ? "자료 생성 중..." : "제출용 거래 자료 (.zip) 다운로드"}
        </button>
      </div>
    </div>
  );
}
