import { createFileRoute } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { useEffect, useState } from "react";

export const Route = createFileRoute("/app/settings/notifications")({
  head: () => ({ meta: [{ title: "알림 설정 — EXPEER" }] }),
  component: NotificationSettings,
});

type Prefs = {
  orders: boolean;
  trades: boolean;
  marketing: boolean;
  push: boolean;
};

const KEY = "expeer.notifPrefs";
const DEFAULTS: Prefs = { orders: true, trades: true, marketing: false, push: true };

function NotificationSettings() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      const v = window.localStorage.getItem(KEY);
      if (v) setPrefs({ ...DEFAULTS, ...JSON.parse(v) });
    } catch {
      /* noop */
    }
  }, []);

  const set = (k: keyof Prefs, v: boolean) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  };

  return (
    <PhoneShell hideTab>
      <AppHeader title="알림 설정" />
      <div className="space-y-2 px-5 py-3">
        <Toggle
          label="주문 알림"
          desc="새 주문·결제 알림"
          value={prefs.orders}
          onChange={(v) => set("orders", v)}
        />
        <Toggle
          label="거래 진행 알림"
          desc="송금/수령/완료"
          value={prefs.trades}
          onChange={(v) => set("trades", v)}
        />
        <Toggle
          label="공지/마케팅"
          desc="이벤트와 업데이트 소식"
          value={prefs.marketing}
          onChange={(v) => set("marketing", v)}
        />
        <Toggle
          label="푸시 알림"
          desc="브라우저/모바일 푸시"
          value={prefs.push}
          onChange={(v) => set("push", v)}
        />
      </div>
    </PhoneShell>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between rounded-2xl border border-border bg-card px-4 py-3.5 text-left"
    >
      <div>
        <div className="text-[14px] font-bold text-foreground">{label}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${value ? "bg-primary" : "bg-surface-strong"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${value ? "left-5" : "left-0.5"}`}
        />
      </span>
    </button>
  );
}
