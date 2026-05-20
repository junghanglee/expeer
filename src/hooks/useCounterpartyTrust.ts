import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Pick<
  Tables<"profiles">,
  "id" | "nickname" | "email" | "kyc_status" | "trade_count" | "rating"
>;

type Review = Tables<"reviews">;

export function useCounterpartyTrust(userId: string | undefined) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setProfile(null);
        setReviews([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const [{ data: profileRow }, { data: reviewRows }] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,nickname,email,kyc_status,trade_count,rating")
          .eq("id", userId)
          .maybeSingle(),
        supabase
          .from("reviews")
          .select("*")
          .eq("reviewee_id", userId)
          .order("created_at", { ascending: false })
          .limit(3),
      ]);

      if (cancelled) return;
      setProfile(profileRow ?? null);
      setReviews(reviewRows ?? []);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const reviewCount = reviews.length;
  const rating = Number(profile?.rating ?? 0);
  const blacklistStatus = useMemo(() => {
    // TODO: 제휴 API 연동 시 10만+ 블랙리스트 DB 대조 결과로 교체.
    // 현재는 온보딩/거래 제한에 걸린 계정 여부만 로컬 신호로 표시한다.
    return profile?.kyc_status === "rejected" ? "attention" : "clear";
  }, [profile?.kyc_status]);

  return {
    profile,
    reviews,
    loading,
    rating,
    reviewCount,
    blacklistStatus,
  };
}

export function displayCounterpartyName(profile: Profile | null | undefined) {
  return profile?.nickname ?? profile?.email?.split("@")[0] ?? "거래 상대";
}
