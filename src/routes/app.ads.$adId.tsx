import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Shield, Clock } from "lucide-react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Section, InfoRow } from "@/components/espeer/Section";
import { BigNumber } from "@/components/espeer/BigNumber";
import { useOffer } from "@/hooks/useOffers";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/app/ads/$adId")({
  head: () => ({ meta: [{ title: "오퍼 상세 — EXPEER" }] }),
  component: OfferDetail,
});

function fmtKrw(n: number) {
  return `₩${Math.round(n).toLocaleString("ko-KR")}`;
}
function fmtNum(n: number) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 4 });
}
function paymentLabel(method: string) {
  if (method === "bank_transfer") return "계좌이체";
  if (method === "toss") return "토스";
  if (method === "kakao_pay") return "카카오페이";
  if (method === "onchain") return "온체인";
  return method;
}

function OfferDetail() {
  const { adId } = Route.useParams();
  const { offer, loading } = useOffer(adId);
  const [seller, setSeller] = useState<Tables<"profiles"> | null>(null);

  useEffect(() => {
    if (!offer) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", offer.user_id)
      .maybeSingle()
      .then(({ data }) => setSeller(data));
  }, [offer]);

  if (loading) {
    return (
      <PhoneShell hideTab>
        <AppHeader title="오퍼 상세" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </PhoneShell>
    );
  }

  if (!offer) {
    return (
      <PhoneShell hideTab>
        <AppHeader title="오퍼를 찾을 수 없음" />
        <div className="p-8 text-center text-[13px] text-muted-foreground">
          존재하지 않거나 비활성화된 오퍼입니다.
        </div>
      </PhoneShell>
    );
  }

  const isSell = offer.side === "sell";

  return (
    <PhoneShell hideTab>
      <AppHeader title="오퍼 상세" />

      <div className="px-5 pt-2">
        <div className="flex items-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-soft font-extrabold text-primary">
            {(seller?.nickname ?? "?").slice(0, 1)}
          </div>
          <div className="flex-1">
            <div className="text-[15px] font-bold text-foreground">
              {seller?.nickname ?? "사용자"}
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">
              거래 {seller?.trade_count ?? 0}건 · 평점 {Number(seller?.rating ?? 0).toFixed(1)}
              {seller?.kyc_status === "approved" && " · KYC 완료"}
            </div>
          </div>
          <span
            className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${isSell ? "bg-destructive-soft text-destructive" : "bg-success-soft text-success"}`}
          >
            {isSell ? "판매" : "구매"}
          </span>
        </div>

        <div className="mt-5">
          <BigNumber
            value={fmtKrw(Number(offer.price))}
            unit={`/ 1 ${offer.asset}`}
            size="xl"
            tone="primary"
          />
          <div className="mt-1 text-[12px] text-muted-foreground">{offer.network} 네트워크</div>
        </div>
      </div>

      <Section title="거래 조건">
        <div className="rounded-2xl border border-border bg-card px-3.5 py-1">
          <InfoRow
            label="가능 수량"
            value={`${fmtNum(Number(offer.available_amount))} ${offer.asset}`}
          />
          <div className="h-px bg-border" />
          <InfoRow label="총 수량" value={`${fmtNum(Number(offer.total_amount))} ${offer.asset}`} />
          <div className="h-px bg-border" />
          <InfoRow
            label="거래 한도"
            value={`${fmtKrw(Number(offer.min_order))} ~ ${fmtKrw(Number(offer.max_order))}`}
          />
          <div className="h-px bg-border" />
          <InfoRow
            label="결제 방법"
            value={
              <span className="flex flex-wrap justify-end gap-1">
                {offer.payment_methods.map((b) => (
                  <span key={b} className="rounded bg-surface-strong px-1.5 py-0.5 text-[11px]">
                    {paymentLabel(b)}
                  </span>
                ))}
              </span>
            }
          />
          <div className="h-px bg-border" />
          <InfoRow
            label="등록"
            value={
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {new Date(offer.created_at).toLocaleString("ko-KR")}
              </span>
            }
          />
        </div>
      </Section>

      {offer.terms && (
        <Section title="오퍼 안내">
          <div className="whitespace-pre-wrap rounded-xl bg-warning-soft px-3 py-2 text-[12px] font-medium text-warning-foreground">
            {offer.terms}
          </div>
        </Section>
      )}

      <Section title="안전 안내">
        <ul className="space-y-2 rounded-2xl border border-border bg-card p-4 text-[13px]">
          <li className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> 거래방 밖의 외부 연락이나 별도 입금 요청은
            피하세요.
          </li>
          <li className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" /> 본인 명의 계좌와 등록 지갑만 사용해 주세요.
          </li>
        </ul>
      </Section>

      <div className="h-24" />
      <div className="sticky bottom-0 left-0 right-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
        <Link
          to="/app/order/new/$adId"
          params={{ adId: offer.id }}
          className="block rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground"
        >
          지금 거래하기
        </Link>
      </div>
    </PhoneShell>
  );
}
