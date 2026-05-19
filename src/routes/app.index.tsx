import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { BigNumber } from "@/components/espeer/BigNumber";
import { VerificationBadge } from "@/components/espeer/Badges";
import { Section } from "@/components/espeer/Section";
import { NotificationBell } from "@/components/espeer/NotificationBell";
import {
  MOCK_ME,
  MOCK_PAIR_STATS,
  MOCK_ACTIVITY,
  STABLE_ASSETS,
  type CryptoAsset,
  type SwapPair,
  fmtKrw,
  fmtNum,
} from "@/data/mock";
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

// 홈에서 선택 가능한 스테이블코인 (KRW 페어 보유분만 노출)
const HOME_STABLES: CryptoAsset[] = STABLE_ASSETS; // USDT, USDC, DAI

function pairFor(asset: CryptoAsset): SwapPair | null {
  if (asset === "USDT") return "USDT/KRW";
  if (asset === "USDC") return "USDC/KRW";
  return null; // DAI는 KRW 페어 미지원 (안내)
}

function AppHome() {
  const [asset, setAsset] = useState<CryptoAsset>("USDT");

  // 프로필에서 저장한 기본 페어가 있으면 자산 동기화
  useEffect(() => {
    const v = window.localStorage.getItem("expeer.defaultPair") as SwapPair | null;
    if (v?.startsWith("USDC")) setAsset("USDC");
    else if (v?.startsWith("USDT")) setAsset("USDT");
  }, []);

  const pair = pairFor(asset);
  const stats = pair ? MOCK_PAIR_STATS[pair] : null;
  const liveActivity = MOCK_ACTIVITY.filter(
    (a) => a.status === "MATCHED" || a.status === "IN_PROGRESS",
  ).length;

  return (
    <PhoneShell>
      <header className="flex items-center justify-between px-5 pb-2 pt-6">
        <div className="leading-tight">
          <div className="text-[20px] font-extrabold text-foreground">EXPEER</div>
          <div className="text-[10px] font-semibold text-muted-foreground">Zero-Custody P2P</div>
        </div>
        <NotificationBell />
      </header>

      {/* 사용자 요약 */}
      <div className="px-5 pt-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-muted-foreground">{MOCK_ME.name}님</span>
          <VerificationBadge level={MOCK_ME.level} />
        </div>
        <div className="mt-2">
          <BigNumber
            value={fmtKrw(MOCK_ME.monthlyVolumeKrw).replace("원", "")}
            unit="원"
            size="xl"
            caption="이번 달 거래 금액"
          />
        </div>
      </div>

      {/* 스테이블코인 선택 */}
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

      {/* 라이브 시세 카드 */}
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
              <div
                className={`text-[12px] font-bold ${
                  stats.change24h >= 0 ? "text-success" : "text-destructive"
                }`}
              >
                {stats.change24h >= 0 ? "+" : ""}
                {stats.change24h.toFixed(2)}%
              </div>
            </div>
            <div className="mt-1 text-[10px] opacity-70">P2P 평균 거래 단가 / 1 {asset}</div>
            <div className="mt-1 flex items-center gap-3 text-[11px] opacity-80">
              <span className="inline-flex items-center gap-1">
                <ActivityIcon className="h-3 w-3" /> 거래 가능 수량{" "}
                {fmtNum(stats.openBuyToken + stats.openSellToken, 0)} {asset}
              </span>
              <span>· 평균 송금 {stats.avgFillSec}초</span>
            </div>
          </Link>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-4 text-center">
            <div className="text-[13px] font-bold text-foreground">
              {asset}는 아직 KRW 환전 페어가 없어요
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              P2P 교환에서 다른 코인과 직접 교환할 수 있어요.
            </div>
            <Link
              to="/app/swap"
              className="mt-3 inline-flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-[12px] font-bold text-primary-foreground"
            >
              P2P 교환 열기 <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* 매수/매도 빠른 진입 */}
        {pair && stats && (
          <div className="mt-2.5 grid grid-cols-2 gap-2.5">
            <Link
              to="/app/market"
              className="card-lift rounded-2xl bg-primary p-4 text-primary-foreground"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold opacity-90">
                <ArrowDownToLine className="h-4 w-4" /> {asset} 사기
              </div>
              <div className="mt-2 num-display text-2xl">₩{fmtNum(stats.bestSell, 0)}</div>
              <div className="text-[11px] opacity-80">최저 판매자 단가 / 1 {asset}</div>
            </Link>
            <Link
              to="/app/market"
              className="card-lift rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2 text-[12px] font-semibold text-muted-foreground">
                <ArrowUpFromLine className="h-4 w-4" /> {asset} 팔기
              </div>
              <div className="mt-2 num-display text-2xl text-foreground">
                ₩{fmtNum(stats.bestBuy, 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">최고 구매자 단가 / 1 {asset}</div>
            </Link>
          </div>
        )}
      </Section>

      {/* 두 가지 거래 모드 안내 */}
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

      {/* Zero-Custody mini banner */}
      <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl border border-primary-soft bg-primary-soft/60 p-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-[11px] leading-relaxed text-foreground/80">
          <b>Zero-Custody</b>: 코인·원화는 EXPEER에 들어오지 않아요. 매칭 시점에만 컨트랙트가
          락업합니다.
        </div>
      </div>

      {/* 진행중 활동 요약 */}
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
              진행중 {liveActivity}건 · 채팅 대기
            </div>
            <div className="text-[11px] text-muted-foreground">
              매칭된 거래는 채팅으로 연결돼요. 완료 후 24시간 유효
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </Section>

      {/* 신뢰 통계 */}
      <Section title="신뢰 통계">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-surface p-4">
          <Stat label="이번주 P2P 거래" value="38,402건" />
          <Stat label="평균 송금 시간" value="62초" />
          <Stat label="분쟁 발생률" value="0.31%" />
        </div>
      </Section>

      <div className="h-6" />
    </PhoneShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="num-display text-[15px] text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
