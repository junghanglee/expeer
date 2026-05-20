import type { RiskTier, VerificationLevel } from "@/data/format";
import { ShieldCheck, BadgeCheck, AlertTriangle } from "lucide-react";

export function RiskBadge({ tier }: { tier: RiskTier }) {
  const map: Record<RiskTier, { bg: string; fg: string; label: string }> = {
    Safe: { bg: "bg-success-soft", fg: "text-success", label: "안전" },
    Standard: { bg: "bg-primary-soft", fg: "text-primary", label: "보통" },
    Restricted: { bg: "bg-warning-soft", fg: "text-warning-foreground", label: "주의" },
    Review: { bg: "bg-destructive-soft", fg: "text-destructive", label: "검토 필요" },
    Suspended: { bg: "bg-destructive-soft", fg: "text-destructive", label: "정지" },
  };
  const m = map[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full ${m.bg} ${m.fg} px-2 py-0.5 text-[11px] font-semibold`}
    >
      <ShieldCheck className="h-3 w-3" />
      {m.label}
    </span>
  );
}

export function VerificationBadge({ level }: { level: VerificationLevel }) {
  const isMerchant = level >= 5;
  const labels = ["미인증", "이메일", "휴대폰", "실명", "지갑검증", "머천트"] as const;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
        isMerchant
          ? "bg-primary text-primary-foreground"
          : level >= 3
            ? "bg-primary-soft text-primary"
            : "bg-surface-strong text-muted-foreground"
      }`}
    >
      <BadgeCheck className="h-3 w-3" />
      {isMerchant ? "머천트" : `Lv.${level} ${labels[level]}`}
    </span>
  );
}

export function WarnPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-[11px] font-semibold text-warning-foreground">
      <AlertTriangle className="h-3 w-3" />
      {children}
    </span>
  );
}
