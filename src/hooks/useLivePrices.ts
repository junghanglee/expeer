import { useEffect, useState, useSyncExternalStore } from "react";
import { getQuotes, type PriceQuote } from "@/utils/prices.functions";

/**
 * 글로벌 시세 스토어 — 여러 컴포넌트가 동일한 폴링/캐시를 공유.
 * - 필요한 심볼을 합쳐서 한 번에 조회
 * - 15초마다 자동 갱신 (CMC 무료 플랜 한도 내)
 * - 직전 값 대비 변동을 감지해 flash 애니메이션에 사용 가능
 */

type Quotes = Record<string, PriceQuote>;

let quotes: Quotes = {};
let prevQuotes: Quotes = {};
let error: string | null = null;
let loading = true;
const subscribed = new Map<string, number>(); // symbol → ref count
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let inflight = false;

function snapshot() {
  return { quotes, prevQuotes, error, loading };
}
let snap = snapshot();

function emit() {
  snap = snapshot();
  listeners.forEach((l) => l());
}

async function refresh() {
  if (inflight) return;
  const symbols = Array.from(subscribed.keys());
  if (symbols.length === 0) return;
  inflight = true;
  try {
    const res = await getQuotes({ data: { symbols } });
    if (res.error) {
      error = res.error;
    } else {
      error = null;
      prevQuotes = quotes;
      quotes = { ...quotes, ...res.quotes };
    }
  } catch {
    error = "시세 조회 실패";
  } finally {
    loading = false;
    inflight = false;
    emit();
  }
}

function ensureTimer() {
  if (timer || subscribed.size === 0) return;
  refresh();
  timer = setInterval(refresh, 15_000);
}

function maybeStopTimer() {
  if (subscribed.size === 0 && timer) {
    clearInterval(timer);
    timer = null;
  }
}

function subscribe(symbols: string[]) {
  symbols.forEach((s) => subscribed.set(s, (subscribed.get(s) ?? 0) + 1));
  ensureTimer();
  // 새 심볼이 추가됐다면 즉시 한 번 더 조회
  if (symbols.some((s) => !(s in quotes))) refresh();
  return () => {
    symbols.forEach((s) => {
      const c = (subscribed.get(s) ?? 1) - 1;
      if (c <= 0) subscribed.delete(s);
      else subscribed.set(s, c);
    });
    maybeStopTimer();
  };
}

function subscribeListener(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useLivePrices(symbols: string[]) {
  const key = symbols.slice().sort().join(",");
  useEffect(() => {
    const syms = key ? key.split(",") : [];
    if (syms.length === 0) return;
    return subscribe(syms);
  }, [key]);

  const state = useSyncExternalStore(
    subscribeListener,
    () => snap,
    () => snap,
  );
  return state;
}

export function useLivePrice(symbol: string) {
  const { quotes: q, prevQuotes: pq, error, loading } = useLivePrices([symbol]);
  const quote = q[symbol] ?? null;
  const prev = pq[symbol] ?? null;
  return { quote, prev, loading: loading && !quote, error };
}

/**
 * 즉시 사용 가능한 가격 헬퍼 — 비동기 갱신 전에 fallback 값을 함께 사용.
 */
export function priceUsd(symbol: string, fallback = 0): number {
  return quotes[symbol]?.priceUsd ?? fallback;
}
export function priceKrw(symbol: string, fallback = 0): number {
  return quotes[symbol]?.priceKrw ?? fallback;
}
