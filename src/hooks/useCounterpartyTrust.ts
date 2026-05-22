import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Profile = Pick<
  Tables<"profiles">,
  "id" | "nickname" | "email" | "phone" | "is_suspended" | "kyc_status" | "trade_count" | "rating"
>;

type Review = Tables<"reviews">;

function normalizePhone(value: string | null | undefined) {
  return (value ?? "").replace(/\D/g, "");
}

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
          .select("id,nickname,email,phone,is_suspended,kyc_status,trade_count,rating")
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
    // 추후 관리자 등록 블랙리스트 DB의 휴대폰 번호 대조 결과로 교체.
    // 현재는 거래 필수값인 휴대폰 등록 여부와 계정 제한 상태를 우선 표시한다.
    if (!normalizePhone(profile?.phone)) return "phone_required";
    if (profile?.is_suspended || profile?.kyc_status === "rejected") return "blocked";
    return "clear";
  }, [profile?.phone, profile?.is_suspended, profile?.kyc_status]);

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
