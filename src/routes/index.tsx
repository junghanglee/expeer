import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PrincipleCard } from "@/components/espeer/PrincipleCard";
import { Logo } from "@/components/espeer/Logo";
import {
  ShieldCheck,
  Lock,
  BadgeCheck,
  ArrowRight,
  User,
  Store,
  ShieldAlert,
  Globe2,
  EyeOff,
  Activity,
  ScanLine,
  Hourglass,
  AlertOctagon,
  CheckCircle2,
  Wallet,
  Building2,
  ArrowUpRight,
  Repeat2,
  Coins,
  Banknote,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EXPEER — 100% 비수탁 P2P 스테이블코인 · 법정화폐 환전소" },
      {
        name: "description",
        content:
          "스테이블코인↔법정화폐, 코인↔코인을 100% 비수탁 스마트 컨트랙트 에스크로로 안전하게 교환하세요. 자산은 본인 지갑·계좌에, 보증은 온체인이 합니다.",
      },
      {
        property: "og:title",
        content: "EXPEER — 100% 비수탁 P2P 스테이블코인 · 법정화폐 환전",
      },
      {
        property: "og:description",
        content:
          "스마트 컨트랙트가 송금을 보장하는 글로벌 P2P 환전·스왑 플랫폼. USDT·USDC·KRW·ETH 등 자유로운 페어, 다층 안전장치, 평균 62초 정산.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top nav (desktop) */}
      <header className="hidden border-b border-border bg-background/80 backdrop-blur lg:block">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo height={28} />
            <span className="ml-2 rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
              GLOBAL
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-[13px] font-semibold text-foreground/70">
            <Link to="/app/market" className="rounded-lg px-3 py-2 hover:bg-surface">
              P2P 환전
            </Link>
            <Link to="/app/swap" className="rounded-lg px-3 py-2 hover:bg-surface">
              코인 교환
            </Link>
            <Link
              to="/app/market"
              className="ml-2 rounded-xl bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              지금 시작하기
            </Link>
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 hidden lg:block">
          <div className="absolute -left-20 top-0 h-[420px] w-[420px] rounded-full bg-primary-soft blur-3xl" />
          <div className="absolute right-0 top-40 h-[320px] w-[320px] rounded-full bg-success-soft blur-3xl opacity-70" />
        </div>

        <div className="mx-auto max-w-[1240px] px-5 pb-12 pt-10 lg:px-6 lg:pb-20 lg:pt-20">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-16">
            {/* LEFT */}
            <div className="anim-fade-up">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
                <span className="h-1.5 w-1.5 rounded-full bg-primary pulse-dot" />
                100% 비수탁 · 스마트 컨트랙트가 송금을 보장합니다
              </div>
              <h1 className="mt-4 text-[34px] font-extrabold leading-[1.12] tracking-tight text-foreground lg:text-[60px]">
                내 지갑에서 바로,
                <br />
                <span className="text-primary">스테이블코인과 현금을 교환</span>하세요.
              </h1>
              <p className="mt-4 text-[14px] leading-relaxed text-muted-foreground lg:mt-6 lg:max-w-[540px] lg:text-[17px]">
                EXPEER는 USDT·USDC 같은{" "}
                <b className="text-foreground">스테이블코인 ↔ 법정화폐(KRW 외)</b>, 그리고{" "}
                <b className="text-foreground">코인 ↔ 코인</b>을 사람과 사람이 직접 교환하는 글로벌
                P2P 환전소입니다.
                <br className="hidden lg:block" />
                자산은 절대 플랫폼에 보관되지 않으며, 모든 거래는{" "}
                <b className="text-foreground">온체인 스마트 컨트랙트</b>가 보증합니다.
              </p>

              <div className="mt-7 flex flex-col gap-2.5 sm:flex-row lg:mt-8">
                <Link
                  to="/app/market"
                  className="card-lift inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3.5 text-[15px] font-bold text-primary-foreground"
                >
                  스테이블코인 환전 <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/app/swap"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-card px-6 py-3.5 text-[15px] font-bold text-foreground hover:bg-surface"
                >
                  코인↔코인 교환 <Repeat2 className="h-4 w-4" />
                </Link>
              </div>

              {/* mini stats */}
              <div className="mt-8 grid grid-cols-3 gap-3 lg:mt-10 lg:max-w-[540px]">
                <MiniStat label="플랫폼 수탁 자산" value="0원" />
                <MiniStat label="평균 정산 시간" value="62초" />
                <MiniStat label="온체인 보증" value="100%" />
              </div>
            </div>

            {/* RIGHT — P2P pair preview card (replaces orderbook) */}
            <div className="lg:pl-4">
              <PairShowcase />
            </div>
          </div>
        </div>
      </section>

      {/* ZERO-CUSTODY 3원칙 — 핵심 정체성 배너 */}
      <section className="border-y border-border bg-foreground py-12 text-background lg:py-16">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-background/80">
            <Lock className="h-3 w-3" /> 100% NON-CUSTODIAL · ON-CHAIN GUARANTEE
          </div>
          <h2 className="mt-3 text-[26px] font-extrabold leading-[1.15] tracking-tight lg:text-[44px]">
            플랫폼은 단 1원, 단 1코인도 보관하지 않습니다.
            <br />
            <span className="text-primary">송금 보장은 스마트 컨트랙트가 책임집니다.</span>
          </h2>
          <p className="mt-3 max-w-[760px] text-[13px] leading-relaxed text-background/70 lg:text-[15px]">
            거래소가 망해도, 운영자가 사라져도 당신의 자산은 안전합니다. EXPEER는 코인도 원화도 받지
            않고, 모든 보증과 전송은 검증된 블록체인 컨트랙트가 자동으로 수행합니다.
          </p>

          <div className="mt-8 grid gap-3 lg:grid-cols-3 lg:gap-5">
            <PrincipleCard
              num="01"
              tag="ZERO-CUSTODY"
              title="자산은 항상 본인 손 안에"
              desc="USDT·USDC·KRW 어떤 것도 EXPEER 계좌·지갑으로 들어오지 않습니다. 코인은 판매자 지갑에, 현금은 매수자 계좌에 그대로 머뭅니다."
            />
            <PrincipleCard
              num="02"
              tag="SMART CONTRACT"
              title="송금은 컨트랙트가 보장"
              desc="매칭 즉시 판매자의 코인이 컨트랙트에 정확한 수량만큼 락업되고, 입금이 검증되면 컨트랙트가 매수자에게 자동 전송합니다."
            />
            <PrincipleCard
              num="03"
              tag="P2P VERIFIED"
              title="릴리즈는 사용자 서명으로"
              desc="중앙 서버가 마음대로 자금을 옮길 수 없습니다. 매수자의 송금 증빙과 판매자의 P2P 서명이 결합되어야만 자산이 이동합니다."
            />
          </div>
        </div>
      </section>

      {/* WHAT YOU CAN TRADE — 서비스 본질 */}
      <section className="bg-surface/60 py-12 lg:py-20">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-6">
          <SectionHead
            tag="WHAT YOU TRADE"
            title={
              <>
                필요한 통화를, 원하는 사람과,
                <br />
                <span className="text-primary">가장 직접적인 가격</span>으로.
              </>
            }
            desc="중간 거래소를 거치지 않습니다. 사용자끼리 직접 가격을 정하고, 컨트랙트가 안전을 보장합니다."
          />
          <div className="mt-8 grid gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-5">
            <ServiceCard
              icon={Banknote}
              tag="P2P 환전"
              title="스테이블코인 ↔ 법정화폐"
              desc="USDT·USDC를 KRW·USD·VND·THB·IDR 등 현지 통화로 즉시 교환. 은행 송금 + 온체인 락업으로 양방향이 모두 안전합니다."
              examples={["USDT / KRW", "USDC / KRW", "USDT / USD"]}
              to="/app/market"
              accent="primary"
            />
            <ServiceCard
              icon={Repeat2}
              tag="코인 스왑"
              title="코인 ↔ 코인"
              desc="BTC·ETH·SOL 등 메이저 자산을 USDT·USDC와 직접 P2P로 교환. 중앙 거래소 상장·출금 한도와 무관하게 자유롭게 거래합니다."
              examples={["ETH / USDT", "BTC / USDT", "SOL / USDC"]}
              to="/app/swap"
              accent="success"
            />
            <ServiceCard
              icon={Coins}
              tag="스테이블 ↔ 스테이블"
              title="USDT ↔ USDC ↔ DAI"
              desc="네트워크 이동·디페그 헷지·차익을 위한 스테이블 간 교환. 같은 1달러여도 시장에 따라 가격이 다르다는 점을 직접 활용하세요."
              examples={["USDT / USDC", "USDC / DAI", "USDT / DAI"]}
              to="/app/swap"
              accent="warning"
            />
          </div>
        </div>
      </section>

      {/* CORE PROMISE — 3 pillars */}
      <section className="py-12 lg:py-20">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-6">
          <SectionHead
            tag="WHY EXPEER"
            title={<>왜 EXPEER인가?</>}
            desc="중앙 거래소의 편리함과 P2P의 자유로움, 그리고 블록체인의 안전성을 한 곳에 모았습니다."
          />
          <div className="mt-8 grid gap-3 lg:mt-12 lg:grid-cols-3 lg:gap-5">
            <PillarCard
              icon={EyeOff}
              tag="PRIVACY"
              title="과도한 KYC 없이"
              desc="정부 ID 제출·얼굴 인증 없이도 거래 가능. 지갑 주소는 자유롭게, 신원은 노출되지 않습니다."
              tone="primary"
            />
            <PillarCard
              icon={ShieldCheck}
              tag="GUARANTEE"
              title="스마트 컨트랙트 보증"
              desc="판매자의 코인은 매칭 즉시 검증된 컨트랙트에 락업. 누구나 BaseScan에서 트랜잭션을 검증할 수 있습니다."
              tone="success"
            />
            <PillarCard
              icon={Zap}
              tag="SPEED"
              title="평균 62초 정산"
              desc="입금 검증이 끝나면 코인이 매수자 지갑으로 즉시 자동 전송. 중간 처리·동결·심사가 없습니다."
              tone="warning"
            />
          </div>
        </div>
      </section>

      {/* SAFEGUARD GRID */}
      <section className="bg-surface/60 py-12 lg:py-20">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-6">
          <SectionHead
            tag="SAFEGUARD STACK"
            title={
              <>
                불법자금 입금에 의한 <span className="text-primary">계좌 지급정지</span>,<br />
                여섯 겹으로 막아냅니다.
              </>
            }
            desc="대포통장·보이스피싱 자금이 판매자 계좌로 들어오는 것을 입구에서부터 차단합니다."
          />

          <div className="stagger mt-8 grid gap-3 lg:mt-12 lg:grid-cols-2 lg:gap-4">
            <SafeguardCard
              num="01"
              icon={BadgeCheck}
              title="실시간 뱅킹 캡처 + 통장 사본 매칭"
              desc="주문 직전 본인 뱅킹 앱 메인화면(잔액·예금주명)을 캡처하면 OCR이 등록 통장 사본과 실시간으로 대조합니다."
            />
            <SafeguardCard
              num="02"
              icon={Wallet}
              title="화이트리스트 계좌 강제 매칭"
              desc="등록된 계좌의 예금주와 실제 입금자명이 한 글자라도 다르면 코인 릴리즈가 비활성화됩니다. 제3자 송금 사기 차단."
            />
            <SafeguardCard
              num="03"
              icon={ScanLine}
              title="안티 피싱 DB 실시간 조회"
              desc="더치트(The Cheat) 등 금융권 공유 사기 DB 연동. 신고 이력 계좌·연락처는 주문 생성 자체가 차단됩니다."
            />
            <SafeguardCard
              num="04"
              icon={Hourglass}
              title="거래 숙성기간 + 단계별 한도"
              desc="신규 가입자는 첫 24~48시간 동안 소액(10만원 미만)만 가능. 즉시 세탁이 필요한 불법 자금을 자연스럽게 걸러냅니다."
            />
            <SafeguardCard
              num="05"
              icon={AlertOctagon}
              title="판매자 자율 매칭 필터"
              desc="‘완료율 95% 이상’, ‘가입 후 7일 경과’, ‘신뢰점수 80점 이상’ 등 판매자가 직접 매칭 조건을 설정할 수 있습니다."
            />
            <SafeguardCard
              num="06"
              icon={Activity}
              title="리스크 엔진 24/7 자동 탐지"
              desc="동일 기기 다계정·VPN·비정상 패턴을 실시간 스코어링. 임계치 초과 시 즉시 격리·검토 큐로 이관됩니다."
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-foreground py-14 text-background lg:py-20">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-background/80">
            HOW IT WORKS
          </div>
          <h2 className="mt-3 text-[26px] font-extrabold leading-tight tracking-tight lg:text-[40px]">
            5단계로 끝나는 안전한 P2P 환전.
          </h2>

          <ol className="mt-8 grid gap-3 lg:mt-12 lg:grid-cols-5">
            {[
              { n: "1", t: "지갑 연결", d: "메타마스크/WC로 서명만, 자산은 그대로" },
              { n: "2", t: "페어 선택", d: "USDT/KRW · ETH/USDT 등 원하는 페어 선택" },
              { n: "3", t: "오퍼 매칭", d: "원하는 가격·수량의 거래 상대 직접 선택" },
              { n: "4", t: "온체인 에스크로", d: "판매자 코인이 컨트랙트에 자동 락업" },
              { n: "5", t: "검증 후 자동 전송", d: "입금 확인 시 컨트랙트가 즉시 릴리즈" },
            ].map((s) => (
              <li
                key={s.n}
                className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur"
              >
                <div className="num-display text-[28px] text-primary">{s.n}</div>
                <div className="mt-1 text-[14px] font-bold">{s.t}</div>
                <div className="mt-1 text-[12px] text-background/70">{s.d}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ROLE CTA */}
      <section className="py-12 lg:py-20">
        <div className="mx-auto max-w-[1240px] px-5 lg:px-6">
          <SectionHead
            tag="GET STARTED"
            title={<>두 가지 목적, 한 번의 안전한 거래.</>}
            desc="EXPEER는 오직 두 가지에 집중합니다 — P2P 환전과 코인 교환."
          />
          <div className="mt-8 grid gap-3 lg:grid-cols-2">
            <RoleCard
              to="/app/market"
              icon={Banknote}
              title="P2P 환전"
              desc="스테이블코인 ↔ 법정화폐 즉시 교환"
              accent
            />
            <RoleCard to="/app/swap" icon={Repeat2} title="코인 교환" desc="코인 ↔ 코인 P2P 스왑" />
          </div>

          <p className="mt-10 text-center text-[11px] leading-relaxed text-muted-foreground">
            EXPEER는 법정통화를 직접 보관하지 않으며, 사용자의 스테이블코인을 수탁하지 않습니다.
            <br />
            모든 거래는 비수탁 에스크로 컨트랙트를 통해 체결됩니다.
          </p>
        </div>
      </section>

      <footer className="border-t border-border bg-background py-8">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center justify-between gap-3 px-5 text-[12px] text-muted-foreground lg:flex-row lg:px-6">
          <div className="flex items-center gap-2">
            <Logo height={20} />
            <span>· Non-custodial P2P stablecoin & crypto exchange</span>
          </div>
          <div>© 2026 EXPEER Labs. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className="num-display mt-0.5 text-[18px] text-foreground lg:text-[20px]">{value}</div>
    </div>
  );
}

function SectionHead({ tag, title, desc }: { tag: string; title: React.ReactNode; desc: string }) {
  return (
    <div className="max-w-[680px]">
      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-[10px] font-bold tracking-wider text-primary">
        {tag}
      </div>
      <h2 className="mt-3 text-[24px] font-extrabold leading-[1.2] tracking-tight text-foreground lg:text-[40px]">
        {title}
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground lg:mt-3 lg:text-[15px]">
        {desc}
      </p>
    </div>
  );
}

function PillarCard({
  icon: Icon,
  tag,
  title,
  desc,
  tone,
}: {
  icon: typeof Lock;
  tag: string;
  title: string;
  desc: string;
  tone: "primary" | "success" | "warning";
}) {
  const map = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning-foreground",
  } as const;
  return (
    <div className="card-lift rounded-3xl border border-border bg-card p-6">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${map[tone]}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4 text-[10px] font-bold tracking-wider text-muted-foreground">{tag}</div>
      <div className="mt-1 text-[20px] font-extrabold tracking-tight text-foreground">{title}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function ServiceCard({
  icon: Icon,
  tag,
  title,
  desc,
  examples,
  to,
  accent,
}: {
  icon: typeof Lock;
  tag: string;
  title: string;
  desc: string;
  examples: string[];
  to: "/app/market" | "/app/swap";
  accent: "primary" | "success" | "warning";
}) {
  const tone = {
    primary: "bg-primary-soft text-primary",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning-foreground",
  }[accent];
  return (
    <div className="card-lift flex h-full flex-col rounded-3xl border border-border bg-card p-6">
      <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${tone}`}>
        <Icon className="h-6 w-6" />
      </div>
      <div className="mt-4 text-[10px] font-bold tracking-wider text-muted-foreground">{tag}</div>
      <div className="mt-1 text-[20px] font-extrabold tracking-tight text-foreground">{title}</div>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {examples.map((e) => (
          <span
            key={e}
            className="num-display rounded-md bg-surface px-2 py-1 text-[11px] text-foreground"
          >
            {e}
          </span>
        ))}
      </div>

      <Link
        to={to}
        className="mt-5 inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline"
      >
        지금 거래하기 <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function SafeguardCard({
  num,
  icon: Icon,
  title,
  desc,
}: {
  num: string;
  icon: typeof Lock;
  title: string;
  desc: string;
}) {
  return (
    <div className="card-lift rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className="num-display text-[22px] text-primary">{num}</div>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-[15px] font-extrabold text-foreground">{title}</div>
      </div>
      <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{desc}</p>
    </div>
  );
}

function RoleCard({
  to,
  icon: Icon,
  title,
  desc,
  accent,
}: {
  to: "/app/market" | "/app/swap";
  icon: typeof User;
  title: string;
  desc: string;
  accent?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`card-lift flex items-center gap-3 rounded-2xl p-5 ${
        accent
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-foreground"
      }`}
    >
      <div
        className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
          accent ? "bg-white/15" : "bg-primary-soft text-primary"
        }`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <div className="text-[15px] font-bold">{title}</div>
        <div className={`text-[12px] ${accent ? "text-white/80" : "text-muted-foreground"}`}>
          {desc}
        </div>
      </div>
      <ArrowRight className="h-5 w-5 opacity-80" />
    </Link>
  );
}

/* ---------- P2P Pair Showcase (replaces orderbook preview) ---------- */
type PairShow = {
  base: string;
  quote: string;
  network: string;
  kind: "환전" | "스왑" | "스테이블";
  price: number;
  changePct: number;
  fmt: (n: number) => string;
  buyers: number;
  sellers: number;
};

const SHOWCASE: PairShow[] = [
  {
    base: "USDT",
    quote: "KRW",
    network: "Polygon",
    kind: "환전",
    price: 1387,
    changePct: 0.12,
    fmt: (n) => Math.round(n).toLocaleString(),
    buyers: 24,
    sellers: 31,
  },
  {
    base: "USDC",
    quote: "KRW",
    network: "Base",
    kind: "환전",
    price: 1389,
    changePct: -0.08,
    fmt: (n) => Math.round(n).toLocaleString(),
    buyers: 18,
    sellers: 22,
  },
  {
    base: "ETH",
    quote: "USDT",
    network: "Arbitrum",
    kind: "스왑",
    price: 3240.45,
    changePct: 0.94,
    fmt: (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    buyers: 9,
    sellers: 12,
  },
  {
    base: "USDT",
    quote: "USDC",
    network: "Polygon",
    kind: "스테이블",
    price: 1.0002,
    changePct: 0.02,
    fmt: (n) => n.toFixed(4),
    buyers: 14,
    sellers: 17,
  },
];

function PairShowcase() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIdx((i) => (i + 1) % SHOWCASE.length), 3500);
    return () => clearInterval(id);
  }, []);

  const active = SHOWCASE[idx];
  const up = active.changePct >= 0;

  const kindTone: Record<PairShow["kind"], string> = {
    환전: "bg-primary-soft text-primary",
    스왑: "bg-success-soft text-success",
    스테이블: "bg-warning-soft text-warning-foreground",
  };

  return (
    <div className="anim-scale-in rounded-3xl border border-border bg-card p-5 shadow-[0_30px_80px_-20px_oklch(0.2_0.04_250/0.18)] lg:p-6">
      {/* Featured pair */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${kindTone[active.kind]}`}
            >
              {active.kind}
            </span>
            <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold text-foreground/70">
              {active.network}
            </span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success pulse-dot" /> LIVE
            </span>
          </div>
          <div
            key={`${active.base}${active.quote}`}
            className="anim-fade-in mt-2 text-[15px] font-extrabold text-foreground"
          >
            {active.base} / {active.quote}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <div key={`p-${idx}`} className="num-display anim-fade-in text-[34px] text-foreground">
              {active.fmt(active.price)}
            </div>
            <div className={`text-[12px] font-bold ${up ? "text-success" : "text-destructive"}`}>
              {up ? "+" : ""}
              {active.changePct.toFixed(2)}%
            </div>
          </div>
        </div>
        <Link
          to={active.kind === "환전" ? "/app/market" : "/app/swap"}
          className="inline-flex items-center gap-1 rounded-xl bg-foreground px-3 py-2 text-[12px] font-bold text-background hover:opacity-90"
        >
          거래 열기 <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Buyer / Seller counters */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-success-soft/60 p-3">
          <div className="text-[10px] font-semibold text-success">구매자 대기</div>
          <div className="num-display mt-0.5 text-[20px] text-foreground">{active.buyers}명</div>
        </div>
        <div className="rounded-xl bg-primary-soft/60 p-3">
          <div className="text-[10px] font-semibold text-primary">판매자 오퍼</div>
          <div className="num-display mt-0.5 text-[20px] text-foreground">{active.sellers}건</div>
        </div>
      </div>

      {/* Pair list (clickable feel) */}
      <div className="mt-4 space-y-1.5">
        <div className="text-[10px] font-bold tracking-wider text-muted-foreground">인기 페어</div>
        {SHOWCASE.map((p, i) => {
          const isActive = i === idx;
          return (
            <button
              key={`${p.base}${p.quote}`}
              onClick={() => setIdx(i)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-colors ${
                isActive ? "bg-surface" : "hover:bg-surface/60"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isActive ? "bg-primary pulse-dot" : "bg-muted-foreground/40"
                  }`}
                />
                <span className="text-[13px] font-bold text-foreground">
                  {p.base}/{p.quote}
                </span>
                <span className="text-[10px] text-muted-foreground">{p.network}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="num-display text-[12px] text-foreground">{p.fmt(p.price)}</span>
                <span
                  className={`text-[11px] font-bold ${
                    p.changePct >= 0 ? "text-success" : "text-destructive"
                  }`}
                >
                  {p.changePct >= 0 ? "+" : ""}
                  {p.changePct.toFixed(2)}%
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* trust badges */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Pill icon={Lock} text="100% 비수탁" />
        <Pill icon={ShieldCheck} text="컨트랙트 보증" />
        <Pill icon={CheckCircle2} text="평균 62초 정산" />
        <Pill icon={Building2} text="화이트리스트 계좌" />
      </div>
    </div>
  );
}

function Pill({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-1 text-[10px] font-bold text-foreground/70">
      <Icon className="h-3 w-3 text-primary" />
      {text}
    </span>
  );
}
