import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Section } from "@/components/espeer/Section";
import { ShieldAlert, Info, Download } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEvidencePackage } from "@/hooks/useEvidencePackage";
import { requestDemoDispute, useOrder } from "@/hooks/useOrders";
import { CounterpartyTrustCard } from "@/components/espeer/CounterpartyTrustCard";

const FIAT_REASONS = [
  "입금했지만 상대방이 확인하지 않음",
  "입금 계좌가 다름",
  "입금자명 불일치",
  "입금 금액 일부만 전송됨",
  "허위 입금완료 표시",
  "상대방이 응답하지 않음",
  "기타",
];

const SWAP_REASONS = [
  "상대방 전송/수령 미확인",
  "지갑 주소 또는 네트워크 불일치",
  "교환 수량 불일치",
  "허위 전송완료 표시",
  "상대방이 응답하지 않음",
  "기타",
];

export const Route = createFileRoute("/app/order/$orderId/dispute")({
  head: () => ({ meta: [{ title: "자료 보존 신청 — EXPEER" }] }),
  component: Dispute,
});

function Dispute() {
  const { orderId } = Route.useParams();
  const { user } = useAuth();
  const { order } = useOrder(orderId);
  const navigate = useNavigate();
  const [reason, setReason] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { download, loading: dlLoading } = useEvidencePackage();
  const isDemo = orderId.startsWith("demo-order-");
  const isCryptoSwap = order?.ads?.kind === "crypto_swap";
  const reasons = isCryptoSwap ? SWAP_REASONS : FIAT_REASONS;
  const counterpartId = order
    ? user?.id === order.buyer_id
      ? order.seller_id
      : user?.id === order.seller_id
        ? order.buyer_id
        : undefined
    : undefined;

  const submit = async () => {
    if (!reason) return;
    if (isDemo) {
      await requestDemoDispute(orderId);
      toast.success("테스트 자료 보존 신청이 완료되었습니다.");
      navigate({ to: "/app/order/$orderId", params: { orderId } });
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      const { error: dErr } = await supabase.from("disputes").insert({
        order_id: orderId,
        opener_id: user.id,
        reason,
        description: description || null,
      });
      if (dErr) throw dErr;

      const { error: oErr } = await supabase
        .from("orders")
        .update({ status: "disputed" })
        .eq("id", orderId);
      if (oErr) throw oErr;

      try {
        await download(orderId);
      } catch (e) {
        console.error("evidence auto-download failed", e);
      }

      toast.success("자료 보존 신청과 증빙 패키지 발급이 완료되었습니다.");
      navigate({ to: "/app/order/$orderId", params: { orderId } });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "신청 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader title="자료 보존 신청" subtitle={`#${orderId.slice(-4)}`} />

      <Section>
        <div className="rounded-2xl border border-primary bg-primary-soft p-4">
          <div className="flex items-start gap-2">
            <Info className="h-5 w-5 shrink-0 text-primary" />
            <div className="text-[12px] leading-relaxed text-foreground">
              <b>문제가 생기면 거래 자료를 즉시 보존합니다.</b>
              <br />
              EXPEER는 현금과 코인을 보관하지 않는 비수탁 P2P 중개 서비스입니다. 대신 주문, 채팅,
              증빙, 분쟁 신청 내역을 제출 가능한 자료로 정리합니다.
            </div>
          </div>
        </div>
      </Section>

      {isDemo && (
        <Section>
          <div className="rounded-2xl border border-success bg-success-soft p-3 text-[12px] font-semibold text-success">
            테스트 주문입니다. 실제 분쟁 등록 없이 자료 보존 화면 흐름만 확인합니다.
          </div>
        </Section>
      )}

      <CounterpartyTrustCard userId={counterpartId} title="거래상대 안전 정보" />

      <Section>
        <div className="rounded-2xl border border-destructive bg-destructive-soft p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            <div className="text-[12px] leading-relaxed text-foreground">
              <b>허위 신청은 계정 제한 사유</b>가 될 수 있습니다. 실제 문제가 있을 때만 신청해
              주세요.
            </div>
          </div>
        </div>
      </Section>

      <Section title="제출용 거래 자료">
        <button
          onClick={() =>
            isDemo
              ? toast.success("테스트 증빙 패키지를 생성한 것처럼 표시합니다.")
              : download(orderId)
          }
          disabled={dlLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-4 py-3.5 text-[13px] font-bold text-primary disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {dlLoading ? "자료 생성 중..." : "제출용 거래 자료(.zip) 다운로드"}
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          주문 내역, 채팅 내역, 입금/교환 증빙, 수수료 기록, 자료 보존 신청 내역을 포함합니다.
          개인정보는 필요한 범위에서만 정리합니다.
        </p>
      </Section>

      <Section title="사유">
        <div className="space-y-1.5">
          {reasons.map((r) => (
            <button
              key={r}
              onClick={() => setReason(r)}
              className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-[13px] font-semibold transition ${
                reason === r
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-border bg-card text-foreground"
              }`}
            >
              {r}
              <span
                className={`h-4 w-4 rounded-full border-2 ${reason === r ? "border-primary bg-primary" : "border-border"}`}
              />
            </button>
          ))}
        </div>
      </Section>

      <Section title="추가 설명">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={
            isCryptoSwap
              ? "지갑 주소, 네트워크, tx hash 등 확인 내용을 적어주세요."
              : "입금 시간, 입금자명, 금액 등 확인 내용을 적어주세요."
          }
          className="h-28 w-full resize-none rounded-2xl bg-surface p-3.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Section>

      <div className="h-24" />
      <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={submit}
          disabled={!reason || submitting}
          className={`block w-full rounded-xl py-3.5 text-center text-[15px] font-bold transition ${
            reason && !submitting
              ? "bg-destructive text-destructive-foreground"
              : "bg-surface-strong text-muted-foreground"
          }`}
        >
          {submitting ? "처리 중..." : "자료 보존 신청"}
        </button>
      </div>
    </PhoneShell>
  );
}
