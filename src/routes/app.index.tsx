import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { BigNumber } from "@/components/espeer/BigNumber";
import { VerificationBadge } from "@/components/espeer/Badges";
import { Section } from "@/components/espeer/Section";
import { NotificationBell } from "@/components/espeer/NotificationBell";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { STABLE_ASSETS, type CryptoAsset, type SwapPair, fmtKrw, fmtNum } from "@/data/format";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronRight,
  ArrowLeftRight,
  ArrowRightLeft,
  Activity as ActivityIcon,
  Lock,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "EXPEER" }] }),
  component: AppHome,
});

type Profile = Tables<"profiles">;
type Order = Tables<"orders">;
type Ad = Tables<"ads">;

type HomeStats = {
  midPrice: number;
  bestSell: number | null;
  bestBuy: number | null;
  openAmount: number;
  avgFillSec: number;
  change24h: number;
};

const HOME_STABLES: readonly CryptoAsset[] = STABLE_ASSETS;
const progressStatuses = [
  "created",
  "info_shared",
  "paid",
  "proof_uploaded",
  "confirmed",
  "released",
  "disputed",
];

function pairFor(asset: CryptoAsset): SwapPair | null {
  if (asset === "USDT") return "USDT/KRW";
  if (asset === "USDC") return "USDC/KRW";
  return null;
}

function AppHome() {
  const { user } = useAuth();
  const [asset, setAsset] = useState<CryptoAsset>("USDT");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);

  useEffect(() => {
    const v = window.localStorage.getItem("expeer.defaultPair") as SwapPair | null;
    if (v?.startsWith("USDC")) setAsset("USDC");
    else if (v?.startsWith("USDT")) setAsset("USDT");
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const pairAssets = HOME_STABLES;
      const adQuery = supabase
        .from("ads")
        .select("*")
        .eq("status", "active")
        .eq("fiat", "KRW")
        .in("asset", pairAssets);

      if (!user) {
        const { data: activeAds } = await adQuery;
        if (!cancelled) {
          setProfile(null);
          setOrders([]);
          setAds(activeAds ?? []);
        }
        return;
      }

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);

      const [{ data: profileRow }, { data: orderRows }, { data: activeAds }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
        supabase
          .from("orders")
          .select("*")
          .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
          .order("created_at", { ascending: false }),
        adQuery,
      ]);

      if (cancelled) return;
      setProfile(profileRow ?? null);
      setOrders(orderRows ?? []);
      setAds(activeAds ?? []);
    }

    load();

    const channel = supabase
      .channel(`home:${user?.id ?? "guest"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "ads" }, load)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user]);

  const pair = pairFor(asset);
  const assetAds = useMemo(() => ads.filter((ad) => ad.asset === asset), [ads, asset]);
  const stats = useMemo(() => makeHomeStats(assetAds), [assetAds]);
  const monthlyVolume = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    return orders
      .filter((order) => new Date(order.created_at) >= monthStart)
      .reduce((sum, order) => sum + Number(order.fiat_amount), 0);
  }, [orders]);
  const liveActivity = orders.filter((order) => progressStatuses.includes(order.status)).length;
  const userName =
    profile?.nickname ?? profile?.real_name ?? user?.email?.split("@")[0] ?? "게스트";
  const kycLevel = Math.min(5, Math.max(0, profile?.kyc_level ?? 0));

  return (
    <PhoneShell>
      <header className="flex items-center justify-between px-5 pb-2 pt-6">
        <div className="leading-tight">
          <div className="text-[20px] font-extrabold text-foreground">EXPEER</div>
          <div className="text-[10px] font-semibold text-muted-foreground">Zero-Custody P2P</div>
        </div>
        <NotificationBell />
      </header>

      <div className="px-5 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-muted-foreground">{userName}님</span>
          <VerificationBadge level={kycLevel as 0 | 1 | 2 | 3 | 4 | 5} />
        </div>
        <div className="mt-2">
          <BigNumber
            value={fmtKrw(monthlyVolume).replace("원", "")}
            unit="원"
            size="xl"
            caption="이번 달 실제 거래 금액"
          />
        </div>
      </div>

      <div className="px-5 pt-3">
        <div className="flex items-center justify-between pb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            스테이블코인 선택
          </span>
          <Link
            to="/app/swap"
            className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary"
          >
            다른 코인 교환 <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {HOME_STABLES.map((a) => {
            const active = a === asset;
            return (
              <button
                key={a}
                onClick={() => setAsset(a)}
                className={`rounded-xl py-2 text-[12px] font-extrabold transition-colors ${
                  active ? "bg-foreground text-background" : "bg-surface text-muted-foreground"
                }`}
              >
                {a}
              </button>
            );
          })}
        </div>
      </div>

      <Section>
        {stats && pair ? (
          <Link
            to="/app/market"
            className="card-lift block rounded-2xl bg-foreground p-4 text-background"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[12px] font-bold opacity-90">
                <ArrowLeftRight className="h-4 w-4" /> P2P 환전 · {pair}
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" /> LIVE
              </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <div className="num-display text-[32px]">{fmtNum(stats.midPrice, 0)}</div>
              <div className="text-[12px] font-bold text-muted-foreground">실제 오퍼 기준</div>
            </div>
            <div className="mt-1 text-[10px] opacity-70">현재 등록된 P2P 평균 단가 / 1 {asset}</div>
            <div className="mt-1 flex items-center gap-3 text-[11px] opacity-80">
              <span className="inline-flex items-center gap-1">
                <ActivityIcon className="h-3 w-3" /> 거래 가능 수량 {fmtNum(stats.openAmount, 0)}{" "}
                {asset}
              </span>
              <span>· 활성 오퍼 {assetAds.length}개</span>
            </div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center">
            <div className="text-[13px] font-bold text-foreground">
              {asset}는 아직 활성 KRW 환전 오퍼가 없어요
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              오퍼가 등록되면 실제 평균 단가와 거래 가능 수량이 표시됩니다.
            </div>
            <Link
              to="/app/swap"
              className="mt-3 inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground"
            >
              P2P 교환 열기 <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {pair && stats && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Link
              to="/app/market"
              className="card-lift rounded-2xl bg-primary p-4 text-primary-foreground"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold opacity-90">
                <ArrowDownToLine className="h-4 w-4" /> {asset} 받기
              </div>
              <div className="mt-2 num-display text-2xl">
                ₩{fmtNum(stats.bestSell ?? stats.midPrice, 0)}
              </div>
              <div className="text-[11px] opacity-80">최저 판매 오퍼 단가 / 1 {asset}</div>
            </Link>
            <Link
              to="/app/market"
              className="card-lift rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
                <ArrowUpFromLine className="h-4 w-4" /> {asset} 보내기
              </div>
              <div className="mt-2 num-display text-2xl text-foreground">
                ₩{fmtNum(stats.bestBuy ?? stats.midPrice, 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">
                최고 구매 오퍼 단가 / 1 {asset}
              </div>
            </Link>
          </div>
        )}
      </Section>

      <Section title="거래 모드">
        <div className="grid grid-cols-2 gap-2">
          <Link to="/app/market" className="card-lift rounded-2xl border border-border bg-card p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-success-soft text-success">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
            <div className="mt-2 text-[13px] font-extrabold text-foreground">P2P 환전</div>
            <div className="text-[11px] text-muted-foreground">스테이블코인 ↔ 법정화폐</div>
          </Link>
          <Link to="/app/swap" className="card-lift rounded-2xl border border-border bg-card p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
            <div className="mt-2 text-[13px] font-extrabold text-foreground">P2P 교환</div>
            <div className="text-[11px] text-muted-foreground">스테이블코인 ↔ 일반 코인</div>
          </Link>
        </div>
      </Section>

      <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-primary-soft bg-primary-soft/60 p-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-[11px] leading-relaxed text-foreground/80">
          <b>Zero-Custody</b>: 코인·원화는 EXPEER에 들어오지 않아요. 매칭 시점에만 컨트랙트가
          락업합니다.
        </div>
      </div>

      <Section
        title="내 활동"
        action={
          <Link
            to="/app/selling"
            className="inline-flex items-center gap-0.5 text-[12px] font-semibold text-primary"
          >
            전체보기 <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        <Link
          to="/app/selling"
          className="card-lift flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-extrabold text-foreground">
              진행중 {liveActivity}건 · 실제 거래방
            </div>
            <div className="text-[11px] text-muted-foreground">
              생성된 주문은 거래방 채팅으로 바로 이어집니다.
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </Section>

      <Section title="실시간 현황">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface p-4">
          <Stat label="활성 오퍼" value={`${ads.length}개`} />
          <Stat label="내 진행 거래" value={`${liveActivity}건`} />
          <Stat label="내 누적 거래" value={`${orders.length}건`} />
        </div>
      </Section>

      <div className="h-6" />
    </PhoneShell>
  );
}

function makeHomeStats(ads: Ad[]): HomeStats | null {
  if (ads.length === 0) return null;
  const prices = ads
    .map((ad) => Number(ad.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  if (prices.length === 0) return null;
  const sellPrices = ads
    .filter((ad) => ad.side === "sell")
    .map((ad) => Number(ad.price))
    .filter((price) => price > 0);
  const buyPrices = ads
    .filter((ad) => ad.side === "buy")
    .map((ad) => Number(ad.price))
    .filter((price) => price > 0);
  return {
    midPrice: prices.reduce((sum, price) => sum + price, 0) / prices.length,
    bestSell: sellPrices.length ? Math.min(...sellPrices) : null,
    bestBuy: buyPrices.length ? Math.max(...buyPrices) : null,
    openAmount: ads.reduce((sum, ad) => sum + Number(ad.available_amount), 0),
    avgFillSec: 0,
    change24h: 0,
  };
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="num-display text-[15px] text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
