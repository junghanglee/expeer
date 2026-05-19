import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export type Review = Tables<"reviews">;

/** 특정 주문에 대한 내 리뷰 작성 여부 + 상대 리뷰 정보 조회 */
export function useOrderReviews(orderId: string | undefined) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!orderId) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase.from("reviews").select("*").eq("order_id", orderId);
    setReviews(data ?? []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const myReview = user ? (reviews.find((r) => r.reviewer_id === user.id) ?? null) : null;
  const counterpartReview = user ? (reviews.find((r) => r.reviewer_id !== user.id) ?? null) : null;

  return { reviews, myReview, counterpartReview, loading, refresh: load };
}

export async function submitReview(input: {
  orderId: string;
  reviewerId: string;
  revieweeId: string;
  rating: number;
  comment?: string;
}) {
  const { error } = await supabase.from("reviews").insert({
    order_id: input.orderId,
    reviewer_id: input.reviewerId,
    reviewee_id: input.revieweeId,
    rating: input.rating,
    comment: input.comment ?? null,
  });
  if (error) throw error;
}

/** 특정 사용자에게 작성된 모든 리뷰 (프로필 페이지용) */
export function useUserReviews(userId: string | undefined) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setReviews([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    supabase
      .from("reviews")
      .select("*")
      .eq("reviewee_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        setReviews(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  return { reviews, loading };
}
