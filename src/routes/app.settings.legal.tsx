import { createFileRoute } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { useState } from "react";
import { FileText, Lock, MessageCircle, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/app/settings/legal")({
  head: () => ({ meta: [{ title: "약관·개인정보·고객센터 — EXPEER" }] }),
  component: Legal,
});

const TERMS = `EXPEER 이용약관 (요약)
1. 본 서비스는 P2P환전·P2P교환의 매칭과 에스크로를 제공합니다.
2. 사용자는 본인 명의 계좌·지갑만 사용해야 합니다.
3. 자산은 EXPEER가 보관하지 않으며, 매칭 시점에만 컨트랙트가 락업됩니다.
4. 분쟁은 증거 자료를 바탕으로 운영팀이 판단합니다.`;

const PRIVACY = `개인정보 처리방침 (요약)
- 수집 항목: 이메일, 닉네임, 신분증·셀카(인증용), 지갑·계좌 정보
- 보관 기간: 회원 탈퇴 또는 법정 보존 기간 종료 시까지
- 제3자 제공: 분쟁 해결·법령 의무 외 제공하지 않음
- 권리: 열람·정정·삭제 요청 가능 (고객센터)`;

function Legal() {
  const [open, setOpen] = useState<string | null>("terms");
  return (
    <PhoneShell hideTab>
      <AppHeader title="약관·개인정보·고객센터" />
      <div className="space-y-2 px-5 py-3">
        <Accordion
          icon={FileText}
          title="이용약관"
          open={open === "terms"}
          onToggle={() => setOpen(open === "terms" ? null : "terms")}
        >
          <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">
            {TERMS}
          </pre>
        </Accordion>
        <Accordion
          icon={Lock}
          title="개인정보 처리방침"
          open={open === "privacy"}
          onToggle={() => setOpen(open === "privacy" ? null : "privacy")}
        >
          <pre className="whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">
            {PRIVACY}
          </pre>
        </Accordion>
        <Accordion
          icon={MessageCircle}
          title="고객센터"
          open={open === "support"}
          onToggle={() => setOpen(open === "support" ? null : "support")}
        >
          <div className="space-y-2 text-[12px]">
            <div>
              이메일:{" "}
              <a className="font-bold text-primary" href="mailto:support@expeer.app">
                support@expeer.app
              </a>
            </div>
            <div>운영시간: 평일 10:00 ~ 19:00 (KST)</div>
            <div className="rounded-xl bg-surface p-3 text-muted-foreground">
              문의 시 거래 ID와 발생 시각을 함께 보내주시면 빠르게 안내해 드립니다.
            </div>
          </div>
        </Accordion>
      </div>
    </PhoneShell>
  );
}

function Accordion({
  icon: Icon,
  title,
  open,
  onToggle,
  children,
}: {
  icon: typeof FileText;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <Icon className="h-4 w-4 text-primary" />
        <span className="flex-1 text-[14px] font-bold text-foreground">{title}</span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border px-4 py-3">{children}</div>}
    </div>
  );
}
