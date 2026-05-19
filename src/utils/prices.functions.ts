import { createServerFn } from "@tanstack/react-start";

/**
 * 실시간 시세 엔진
 * - 1차: CoinMarketCap (유료, 분당 30 call)
 * - 2차: CoinGecko (무료 폴백, 분당 ~30 call)
 * - 메모리 캐시 5초
 *
 * 주문 생성 시점에 KRW 마크 가격 스냅샷을 잡아 분쟁 근거로 보존한다.
 */

const CMC_BASE = "https://pro-api.coinmarketcap.com/v2";
const CG_BASE = "https://api.coingecko.com/api/v3";

export type PriceQuote = {
  symbol: string;
  priceUsd: number;
  priceKrw: number;
  change24h: number;
  updatedAt: string;
  source: "coinmarketcap" | "coingecko";
};

let cache: { at: number; data: Record<string, PriceQuote> } | null = null;
const CACHE_TTL_MS = 5_000;

const DEFAULT_SYMBOLS = ["USDT", "USDC", "DAI", "BTC", "ETH", "SOL", "BNB", "XRP", "MATIC"];

// CoinGecko id 매핑 (폴백용)
const CG_IDS: Record<string, string> = {
  USDT: "tether",
  USDC: "usd-coin",
  DAI: "dai",
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  BNB: "binancecoin",
  XRP: "ripple",
  MATIC: "matic-network",
};

async function fetchFromCMC(symbols: string[]): Promise<Record<string, PriceQuote>> {
  const apiKey = process.env.COINMARKETCAP_API_KEY;
  if (!apiKey) throw new Error("no_cmc_key");

  const usdRes = await fetch(
    `${CMC_BASE}/cryptocurrency/quotes/latest?symbol=${symbols.join(",")}&convert=USD`,
    { headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" } },
  );
  if (!usdRes.ok) throw new Error(`cmc_${usdRes.status}`);
  const usdJson = await usdRes.json();

  const krwRes = await fetch(
    `${CMC_BASE}/tools/price-conversion?amount=1&symbol=USDT&convert=KRW`,
    { headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" } },
  );
  const krwJson = krwRes.ok ? await krwRes.json() : null;
  const usdToKrw: number = krwJson?.data?.[0]?.quote?.KRW?.price ?? 1380;

  const quotes: Record<string, PriceQuote> = {};
  for (const sym of symbols) {
    const entry = usdJson?.data?.[sym];
    const item = Array.isArray(entry) ? entry[0] : entry;
    if (!item) continue;
    const usd = item.quote?.USD?.price ?? 0;
    quotes[sym] = {
      symbol: sym,
      priceUsd: usd,
      priceKrw: usd * usdToKrw,
      change24h: item.quote?.USD?.percent_change_24h ?? 0,
      updatedAt: item.quote?.USD?.last_updated ?? new Date().toISOString(),
      source: "coinmarketcap",
    };
  }
  return quotes;
}

async function fetchFromCoinGecko(symbols: string[]): Promise<Record<string, PriceQuote>> {
  const ids = symbols.map((s) => CG_IDS[s]).filter(Boolean);
  if (ids.length === 0) return {};
  const url = `${CG_BASE}/simple/price?ids=${ids.join(",")}&vs_currencies=usd,krw&include_24hr_change=true`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`cg_${res.status}`);
  const json = await res.json();
  const now = new Date().toISOString();
  const quotes: Record<string, PriceQuote> = {};
  for (const sym of symbols) {
    const id = CG_IDS[sym];
    const item = id ? json[id] : null;
    if (!item) continue;
    quotes[sym] = {
      symbol: sym,
      priceUsd: item.usd ?? 0,
      priceKrw: item.krw ?? (item.usd ?? 0) * 1380,
      change24h: item.usd_24h_change ?? 0,
      updatedAt: now,
      source: "coingecko",
    };
  }
  return quotes;
}

export const getQuotes = createServerFn({ method: "GET" })
  .inputValidator((input: { symbols?: string[] } | undefined) => input ?? {})
  .handler(
    async ({ data }): Promise<{ quotes: Record<string, PriceQuote>; error: string | null }> => {
      const symbols =
        data.symbols && data.symbols.length > 0
          ? Array.from(new Set(data.symbols.map((s) => s.toUpperCase())))
          : DEFAULT_SYMBOLS;

      const now = Date.now();
      if (cache && now - cache.at < CACHE_TTL_MS) {
        const filtered: Record<string, PriceQuote> = {};
        for (const s of symbols) if (cache.data[s]) filtered[s] = cache.data[s];
        if (Object.keys(filtered).length === symbols.length) {
          return { quotes: filtered, error: null };
        }
      }

      // Try CMC first, fallback to CoinGecko
      let quotes: Record<string, PriceQuote> = {};
      let primaryError: string | null = null;
      try {
        quotes = await fetchFromCMC(symbols);
      } catch (e: unknown) {
        primaryError = e instanceof Error ? e.message : "cmc_failed";
        console.warn("[prices] CMC failed, falling back to CoinGecko:", primaryError);
      }

      // Fill missing symbols with CoinGecko
      const missing = symbols.filter((s) => !quotes[s]);
      if (missing.length > 0) {
        try {
          const cg = await fetchFromCoinGecko(missing);
          quotes = { ...quotes, ...cg };
        } catch (e) {
          console.error("[prices] CoinGecko fallback failed:", e);
        }
      }

      if (Object.keys(quotes).length === 0) {
        return { quotes: {}, error: "시세 서비스에 일시적인 문제가 발생했습니다" };
      }

      cache = { at: now, data: { ...(cache?.data ?? {}), ...quotes } };
      return { quotes, error: null };
    },
  );

/**
 * 단일 심볼 KRW 마크 가격 스냅샷.
 * 주문 생성 시점에 호출하여 orders.price_snapshot_krw 에 기록한다.
 */
export const getMarkPriceKrw = createServerFn({ method: "GET" })
  .inputValidator((input: { symbol: string }) => ({ symbol: input.symbol.toUpperCase() }))
  .handler(
    async ({ data }): Promise<{ priceKrw: number | null; source: string | null; at: string }> => {
      const res = await getQuotes({ data: { symbols: [data.symbol] } });
      const q = res.quotes[data.symbol];
      if (!q) return { priceKrw: null, source: null, at: new Date().toISOString() };
      return { priceKrw: q.priceKrw, source: q.source, at: q.updatedAt };
    },
  );
