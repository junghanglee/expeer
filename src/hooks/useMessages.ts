import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export type Message = Tables<"messages">;

/**
 * 주문별 채팅 메시지 훅 — 실시간 구독 포함.
 */
export function useMessages(orderId: string | undefined) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const load = useCallback(async () => {
    if (!orderId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    setMessages(data ?? []);
    setLoading(false);
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime 구독
  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`messages:${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `order_id=eq.${orderId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [orderId]);

  // 읽음 처리 — 내가 받은 메시지 중 안 읽은 것
  useEffect(() => {
    if (!user || !orderId) return;
    const unread = messages.filter((m) => m.sender_id !== user.id && !m.read_at);
    if (unread.length === 0) return;
    const ids = unread.map((m) => m.id);
    supabase
      .from("messages")
      .update({ read_at: new Date().toISOString() })
      .in("id", ids)
      .then(() => {
        // 로컬도 갱신
        setMessages((prev) =>
          prev.map((m) => (ids.includes(m.id) ? { ...m, read_at: new Date().toISOString() } : m)),
        );
      });
  }, [messages, user, orderId]);

  return { messages, loading, refresh: load };
}

export async function sendMessage(orderId: string, senderId: string, content: string) {
  const { error } = await supabase.from("messages").insert({
    order_id: orderId,
    sender_id: senderId,
    type: "text",
    content,
  });
  if (error) throw error;
}
