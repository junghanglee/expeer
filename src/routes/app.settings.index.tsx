import { createFileRoute, Link } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Bell, Shield, Languages, FileText, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/app/settings/")({
  head: () => ({ meta: [{ title: "설정 — EXPEER" }] }),
  component: SettingsIndex,
});

const ITEMS = [
  {
    to: "/app/settings/notifications",
    icon: Bell,
    label: "알림 설정",
    desc: "주문·거래·공지 알림",
  },
  { to: "/app/settings/security", icon: Shield, label: "보안", desc: "비밀번호 변경, 2단계 인증" },
  {
    to: "/app/settings/appearance",
    icon: Languages,
    label: "언어 / 테마",
    desc: "다크모드·언어 선택",
  },
  {
    to: "/app/settings/legal",
    icon: FileText,
    label: "약관·개인정보·고객센터",
    desc: "이용약관과 문의",
  },
] as const;

function SettingsIndex() {
  return (
    <PhoneShell hideTab>
      <AppHeader title="설정" />
      <div className="px-5 py-3">
        <div className="rounded-2xl border border-border bg-card">
          {ITEMS.map((it, i) => (
            <Link
              key={it.to}
              to={it.to}
              className={`flex items-center gap-3 px-4 py-4 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface text-primary">
                <it.icon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-[14px] font-bold text-foreground">{it.label}</div>
                <div className="text-[11px] text-muted-foreground">{it.desc}</div>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </div>
    </PhoneShell>
  );
}
