import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Star } from "lucide-react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Section } from "@/components/espeer/Section";
import { useAuth } from "@/lib/auth";
import { useOrder } from "@/hooks/useOrders";
import { submitReview, useOrderReviews } from "@/hooks/useReviews";
import { toast } from "sonner";

export const Route = createFileRoute("/app/order/$orderId/review")({
  head: () => ({ meta: [{ title: "거래 리뷰 작성 — EXPEER" }] }),
  component: ReviewPage,
});

function ReviewPage() {
  const { orderId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { order, loading } = useOrder(orderId);
  const { myReview, counterpartReview, refresh } = useOrderReviews(orderId);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <PhoneShell hideTab>
        <AppHeader title="리뷰 작성" />
        <div className="px-5 py-8 text-center text-muted-foreground">로딩 중…</div>
      </PhoneShell>
    );
  }
  if (!order || !user) {
    return (
      <PhoneShell hideTab>
        <AppHeader title="리뷰 작성" />
        <div className="px-5 py-8 text-center text-muted-foreground">
          접근할 수 없는 주문입니다.
        </div>
      </PhoneShell>
    );
  }

  const isBuyer = user.id === order.buyer_id;
  const isSeller = user.id === order.seller_id;
  if (!isBuyer && !isSeller) {
    return (
      <PhoneShell hideTab>
        <AppHeader title="리뷰 작성" />
        <div className="px-5 py-8 text-center text-muted-foreground">
          거래 당사자만 리뷰를 작성할 수 있습니다.
        </div>
      </PhoneShell>
    );
  }
  if (order.status !== "completed") {
    return (
      <PhoneShell hideTab>
        <AppHeader title="리뷰 작성" />
        <div className="px-5 py-8 text-center text-muted-foreground">
          완료된 거래에만 리뷰를 작성할 수 있습니다.
        </div>
      </PhoneShell>
    );
  }

  const isCryptoSwap = order.ads?.kind === "crypto_swap";
  const revieweeId = isBuyer ? order.seller_id : order.buyer_id;
  const revieweeRole = isBuyer ? "오퍼 등록자" : "참여자";
  const tradeLabel = isCryptoSwap ? "교환" : "환전";

  const submit = async () => {
    setSubmitting(true);
    try {
      await submitReview({
        orderId: order.id,
        reviewerId: user.id,
        revieweeId,
        rating,
        comment: comment.trim() || undefined,
      });
      toast.success("리뷰가 등록되었습니다");
      await refresh();
      navigate({ to: "/app/order/$orderId", params: { orderId } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "오류";
      toast.error(msg.includes("duplicate") ? "이미 리뷰를 작성했습니다" : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader
        title={`${revieweeRole} 평가`}
        subtitle={`${tradeLabel} 주문 #${orderId.slice(-4)}`}
      />

      {myReview ? (
        <Section>
          <div className="rounded-2xl border border-success bg-success-soft p-5 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success text-success-foreground">
              <Check className="h-6 w-6" strokeWidth={3} />
            </div>
            <div className="mt-3 text-[14px] font-bold text-foreground">이미 리뷰를 작성했어요</div>
            <div className="mt-2 flex justify-center gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-5 w-5 ${i < myReview.rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                />
              ))}
            </div>
            {myReview.comment && (
              <div className="mt-2 text-[12px] text-muted-foreground">“{myReview.comment}”</div>
            )}
          </div>
        </Section>
      ) : (
        <>
          <Section title="별점">
            <div className="flex justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} aria-label={`${n}점`}>
                  <Star
                    className={`h-9 w-9 transition ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
            <div className="text-center text-[12px] text-muted-foreground">
              {["매우 불만족", "불만족", "보통", "만족", "매우 만족"][rating - 1]}
            </div>
          </Section>

          <Section title="코멘트 (선택)">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={300}
              placeholder={`${tradeLabel} 거래 경험을 짧게 남겨주세요`}
              className="h-28 w-full resize-none rounded-2xl bg-surface p-3.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="mt-1 text-right text-[11px] text-muted-foreground">
              {comment.length}/300
            </div>
          </Section>

          <div className="h-24" />
          <div className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 py-3 backdrop-blur">
            <button
              onClick={submit}
              disabled={submitting}
              className="block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground disabled:opacity-50"
            >
              {submitting ? "제출 중…" : "리뷰 등록"}
            </button>
          </div>
        </>
      )}

      {counterpartReview && (
        <Section title="상대방이 남긴 평가">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="flex gap-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${i < counterpartReview.rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                />
              ))}
            </div>
            {counterpartReview.comment && (
              <div className="mt-2 text-[13px] text-foreground">“{counterpartReview.comment}”</div>
            )}
          </div>
        </Section>
      )}
    </PhoneShell>
  );
}
