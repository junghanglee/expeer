import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export type Message = Tables<"messages">;

const DEMO_MESSAGES_KEY = "expeer.demo.messages.v1";

function canUseLocalStorage() {
  return typeof window !== "undefined" && !!window.localStorage;
}

function readDemoMessageStore(): Record<string, Message[]> {
  if (!canUseLocalStorage()) return {};
  try {
    return JSON.parse(window.localStorage.getItem(DEMO_MESSAGES_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeDemoMessage(orderId: string, message: Message) {
  if (!canUseLocalStorage()) return;
  const store = readDemoMessageStore();
  store[orderId] = [...(store[orderId] ?? []), message];
  window.localStorage.setItem(DEMO_MESSAGES_KEY, JSON.stringify(store));
}

function demoMessages(orderId: string): Message[] {
  if (!orderId.startsWith("demo-order-")) return [];
  const now = Date.now();
  const seed = [
    {
      id: `${orderId}-msg-1`,
      order_id: orderId,
      sender_id: "demo-system",
      type: "system",
      content:
        "테스트 주문이 생성되었습니다. 이 거래방에서 입금확인, 증빙, 분쟁 대비 기록을 확인할 수 있습니다.",
      attachment_url: null,
      metadata: { demo: true, event: "order_created" },
      read_at: new Date(now - 110_000).toISOString(),
      created_at: new Date(now - 120_000).toISOString(),
    },
    {
      id: `${orderId}-msg-2`,
      order_id: orderId,
      sender_id: "demo-merchant-sell-1",
      type: "text",
      content:
        "안녕하세요. 주문 금액과 입금자명이 일치하면 바로 확인하겠습니다. 거래방 밖 연락은 하지 않습니다.",
      attachment_url: null,
      metadata: { demo: true },
      read_at: null,
      created_at: new Date(now - 70_000).toISOString(),
    },
    {
      id: `${orderId}-msg-3`,
      order_id: orderId,
      sender_id: "demo-current-user",
      type: "text",
      content: "확인했습니다. 입금 후 증빙을 첨부하겠습니다.",
      attachment_url: null,
      metadata: { demo: true },
      read_at: new Date(now - 20_000).toISOString(),
      created_at: new Date(now - 40_000).toISOString(),
    },
  ] as Message[];
  const extra = readDemoMessageStore()[orderId] ?? [];
  return [...seed, ...extra].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
}

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
    if (orderId.startsWith("demo-order-")) {
      setMessages(demoMessages(orderId));
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
    if (!orderId || orderId.startsWith("demo-order-")) return;
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
  if (orderId.startsWith("demo-order-")) {
    const now = new Date().toISOString();
    writeDemoMessage(orderId, {
      id: `${orderId}-msg-${Date.now()}`,
      order_id: orderId,
      sender_id: senderId,
      type: "text",
      content,
      attachment_url: null,
      metadata: { demo: true },
      read_at: now,
      created_at: now,
    } as Message);
    return;
  }
  const { error } = await supabase.from("messages").insert({
    order_id: orderId,
    sender_id: senderId,
    type: "text",
    content,
  });
  if (error) throw error;
}
