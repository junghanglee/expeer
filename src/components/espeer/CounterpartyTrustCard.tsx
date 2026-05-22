import { Section } from "@/components/espeer/Section";
import { displayCounterpartyName, useCounterpartyTrust } from "@/hooks/useCounterpartyTrust";
import { BadgeCheck, ShieldCheck, Star } from "lucide-react";

export function CounterpartyTrustCard({
  userId,
  title = "거래상대 신뢰도",
}: {
  userId?: string;
  title?: string;
}) {
  const { profile, reviews, loading, rating, reviewCount, blacklistStatus } =
    useCounterpartyTrust(userId);

  if (!userId || loading) return null;

  const clear = blacklistStatus === "clear";
  const statusText =
    blacklistStatus === "clear"
      ? "블랙리스트 특이사항 없음"
      : blacklistStatus === "phone_required"
        ? "휴대폰 등록 필요"
        : "승인 제한 대상";

  return (
    <Section title={title}>
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-[15px] font-extrabold text-foreground">
              {displayCounterpartyName(profile)}
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[10px] font-bold text-warning">
                <Star className="h-3 w-3 fill-warning" />
                {rating > 0 ? `${rating.toFixed(2)}점` : "평가 대기"}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                <BadgeCheck className="h-3 w-3" />
                거래 {profile?.trade_count ?? 0}건
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  clear ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive"
                }`}
              >
                <ShieldCheck className="h-3 w-3" />
                {statusText}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-surface p-3 text-[11px] leading-relaxed text-muted-foreground">
          리뷰 평판과 거래 이력을 함께 확인하세요. 블랙리스트 검증은 관리자 등록 DB의 휴대폰 번호
          대조 방식으로 연결될 예정이며, 현재는 휴대폰 등록/계정 제한 상태를 먼저 확인합니다.
        </div>

        {reviews.length > 0 ? (
          <div className="mt-3 space-y-2">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-border bg-background px-3 py-2"
              >
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-bold text-warning">★ {review.rating}</span>
                  <span className="text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString("ko-KR")}
                  </span>
                </div>
                {review.comment && (
                  <div className="mt-1 text-[12px] text-foreground">“{review.comment}”</div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-border p-3 text-center text-[11px] text-muted-foreground">
            아직 공개 리뷰가 없습니다.
          </div>
        )}

        <div className="mt-2 text-[10px] text-muted-foreground">최근 리뷰 {reviewCount}개 표시</div>
      </div>
    </Section>
  );
}
