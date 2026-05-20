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
import { useOrder } from "@/hooks/useOrders";
import { CounterpartyTrustCard } from "@/components/espeer/CounterpartyTrustCard";

const REASONS = [
  "송금했으나 판매자가 확인하지 않음",
  "송금 계좌가 다름",
  "입금자명 불일치",
  "입금 금액이 일부만 도착",
  "허위 입금완료 표시",
  "판매자가 응답하지 않음",
  "기타",
];

export const Route = createFileRoute("/app/order/$orderId/dispute")({
  head: () => ({ meta: [{ title: "분쟁 자료 보존 신청 — EXPEER" }] }),
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
  const counterpartId = order
    ? user?.id === order.buyer_id
      ? order.seller_id
      : user?.id === order.seller_id
        ? order.buyer_id
        : undefined
    : undefined;

  const submit = async () => {
    if (!reason || !user) return;
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

      // 분쟁 접수와 동시에 증빙 패키지 자동 생성·다운로드
      try {
        await download(orderId);
      } catch (e) {
        console.error("evidence auto-download failed", e);
      }

      toast.success("자료 보존 모드 전환 + 증빙 패키지 발급 완료");
      navigate({ to: "/app/order/$orderId", params: { orderId } });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "신청 실패";
      toast.error(message);
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
              <b>필요한 경우에만 자료를 보존하고 내려받으세요.</b>
              <br />이 자료는 경찰 신고 또는 은행 제출용으로 활용할 수 있는 거래 기록 사본입니다.
              EXPEER는 현금·코인을 보관하지 않는 비수탁 P2P 중개 서비스입니다.
            </div>
          </div>
        </div>
      </Section>

      <CounterpartyTrustCard userId={counterpartId} title="거래상대 확인" />

      <Section>
        <div className="rounded-2xl border border-destructive bg-destructive-soft p-4">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
            <div className="text-[12px] leading-relaxed text-foreground">
              <b>허위 신청은 계정 제재 사유</b>가 될 수 있습니다.
            </div>
          </div>
        </div>
      </Section>

      <Section title="제출용 거래 자료">
        <button
          onClick={() => download(orderId)}
          disabled={dlLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft px-4 py-3.5 text-[13px] font-bold text-primary disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          {dlLoading ? "자료 생성 중..." : "제출용 거래 자료 (.zip) 다운로드"}
        </button>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          구매내역, 채팅내역, 송금 증빙, 토큰 전송내역, 온체인 에스크로 기록이 포함됩니다.
          개인정보는 필요한 범위에서 마스킹됩니다.
        </p>
      </Section>

      <Section title="사유">
        <div className="space-y-1.5">
          {REASONS.map((r) => (
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
                className={`h-4 w-4 rounded-full border-2 ${
                  reason === r ? "border-primary bg-primary" : "border-border"
                }`}
              />
            </button>
          ))}
        </div>
      </Section>

      <Section title="추가 설명 (선택)">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="상황을 자세히 설명해 주세요"
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
