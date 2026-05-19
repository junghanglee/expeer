import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { Section } from "@/components/espeer/Section";
import { BigNumber } from "@/components/espeer/BigNumber";
import { MOCK_ACTIVITY, fmtKrw, type ActivitySession } from "@/data/mock";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  MessageSquare,
  ArrowLeftRight,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  BadgeCheck,
  Sparkles,
  Bell,
} from "lucide-react";

export const Route = createFileRoute("/app/selling")({
  head: () => ({ meta: [{ title: "내 활동 — EXPEER" }] }),
  component: ActivityPage,
});

type Tab = "all" | "fiat" | "crypto";

// /app/selling 경로를 유지하되 라벨/내용은 통합 "활동"으로 사용한다.
function ActivityPage() {
  const [tab, setTab] = useState<Tab>("all");

  const list = useMemo(() => {
    if (tab === "all") return MOCK_ACTIVITY;
    return MOCK_ACTIVITY.filter((a) => a.kind === tab);
  }, [tab]);

  const newRequests = MOCK_ACTIVITY.filter((a) => a.status === "MATCHED").length;

  return (
    <PhoneShell>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/app"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-foreground">내 활동</div>
            <div className="text-[10px] font-semibold text-muted-foreground">
              P2P 환전 · 코인 교환 통합
            </div>
          </div>
        </div>
        <div className="relative">
          <button className="flex h-9 w-9 items-center justify-center rounded-full bg-surface">
            <Bell className="h-4 w-4" />
          </button>
          {newRequests > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
              {newRequests}
            </span>
          )}
        </div>
      </header>

      {/* 요약 — 금액 + 핵심 KPI 한 카드로 통합 */}
      <div className="px-5 pt-5">
        <BigNumber
          value={fmtKrw(2_854_000).replace("원", "")}
          unit="원"
          size="xl"
          tone="primary"
          caption="이번 주 활동 금액"
        />
      </div>

      <Section>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-4">
          <KPI label="진행중" value="3" />
          <KPI label="완료" value="42" />
          <KPI label="분쟁률" value="0.0%" />
        </div>
      </Section>

      {/* Zero-Custody · 채팅 정책 */}
      <div className="mx-5 flex items-start gap-2 rounded-xl border border-primary-soft bg-primary-soft/60 p-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-[11px] leading-relaxed text-foreground/80">
          매칭이 성사되면 채팅이 자동으로 열려요. 거래 완료 후 <b>24시간</b>까지 대화가 유효합니다.
        </div>
      </div>

      {/* Tabs — 환전/교환 분리 */}
      <div className="mt-3 flex gap-1 px-5">
        <TabBtn active={tab === "all"} onClick={() => setTab("all")}>
          전체 <span className="ml-1 text-[11px] opacity-70">{MOCK_ACTIVITY.length}</span>
        </TabBtn>
        <TabBtn active={tab === "fiat"} onClick={() => setTab("fiat")}>
          P2P 환전
        </TabBtn>
        <TabBtn active={tab === "crypto"} onClick={() => setTab("crypto")}>
          P2P 교환
        </TabBtn>
      </div>

      {/* 새 오퍼 만들기 */}
      <div className="mx-5 mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/app/market"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-[12px] font-bold text-foreground"
        >
          <ArrowLeftRight className="h-3.5 w-3.5 text-success" /> 환전 오퍼 만들기
        </Link>
        <Link
          to="/app/swap"
          className="flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-[12px] font-bold text-foreground"
        >
          <ArrowRightLeft className="h-3.5 w-3.5 text-primary" /> 교환 오퍼 만들기
        </Link>
      </div>

      <Section title="진행중·완료 거래">
        <div className="space-y-2">
          {list.map((a) => (
            <ActivityCard key={a.id} session={a} />
          ))}
          {list.length === 0 && (
            <div className="rounded-2xl border border-dashed border-border bg-card py-10 text-center text-[12px] text-muted-foreground">
              아직 활동이 없어요.
            </div>
          )}
        </div>
      </Section>

      <div className="h-6" />
    </PhoneShell>
  );
}

function KPI({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="num-display text-[16px] text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl py-2 text-[12px] font-bold transition-colors ${
        active ? "bg-foreground text-background" : "bg-surface text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function ActivityCard({ session }: { session: ActivitySession }) {
  const isCrypto = session.kind === "crypto";
  const statusMap = {
    MATCHED: { label: "신규 매칭", cls: "bg-warning-soft text-warning", icon: Sparkles },
    IN_PROGRESS: { label: "진행 중", cls: "bg-primary-soft text-primary", icon: Clock },
    COMPLETED: { label: "완료", cls: "bg-success-soft text-success", icon: CheckCircle2 },
    EXPIRED: { label: "만료", cls: "bg-surface text-muted-foreground", icon: Clock },
  } as const;
  const s = statusMap[session.status];
  const Icon = s.icon;
  const chatEnabled = session.status !== "EXPIRED";

  return (
    <div className="card-lift rounded-2xl border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
              isCrypto ? "bg-primary-soft text-primary" : "bg-success-soft text-success"
            }`}
          >
            {isCrypto ? (
              <ArrowRightLeft className="mr-0.5 inline h-2.5 w-2.5" />
            ) : (
              <ArrowLeftRight className="mr-0.5 inline h-2.5 w-2.5" />
            )}
            {isCrypto ? "P2P 교환" : "P2P 환전"}
          </span>
          <span
            className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${s.cls}`}
          >
            <Icon className="h-2.5 w-2.5" /> {s.label}
          </span>
        </div>
        <span className="text-[10px] text-muted-foreground">{session.matchedAt}</span>
      </div>

      <div className="mt-2 text-[13px] font-extrabold text-foreground">{session.title}</div>

      <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {session.counterpartIsMerchant && <BadgeCheck className="h-3 w-3 text-primary" />}
        <span className="font-semibold text-foreground/80">{session.counterpartName}</span>
      </div>

      {session.lastMessage && (
        <div className="mt-2 truncate rounded-lg bg-surface px-2 py-1.5 text-[11px] text-foreground/80">
          <MessageSquare className="mr-1 inline h-3 w-3 text-muted-foreground" />
          {session.lastMessage}
        </div>
      )}

      {session.status === "COMPLETED" && session.chatExpiresAt && (
        <div className="mt-1.5 text-[10px] text-muted-foreground">
          <Clock className="mr-0.5 inline h-3 w-3" /> 채팅 유효 {session.chatExpiresAt}
        </div>
      )}

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <Link
          to="/app/order/$orderId/chat"
          params={{ orderId: session.id }}
          search={{ role: "seller" }}
          className={`relative flex items-center justify-center gap-1 rounded-xl py-2 text-[11px] font-bold ${
            chatEnabled
              ? "bg-primary text-primary-foreground"
              : "bg-surface text-muted-foreground pointer-events-none"
          }`}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          채팅 {chatEnabled ? "열기" : "만료"}
          {session.unread > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
              {session.unread}
            </span>
          )}
        </Link>
        <Link
          to={isCrypto ? "/app/swap" : "/app/market"}
          className="flex items-center justify-center gap-1 rounded-xl bg-surface py-2 text-[11px] font-bold text-foreground/80"
        >
          상세 보기 <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
