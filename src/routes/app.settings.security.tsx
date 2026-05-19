import { createFileRoute } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Lock, ShieldCheck, Loader2 } from "lucide-react";

export const Route = createFileRoute("/app/settings/security")({
  head: () => ({ meta: [{ title: "보안 — EXPEER" }] }),
  component: SecuritySettings,
});

function SecuritySettings() {
  const { user } = useAuth();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const change = async () => {
    if (next.length < 8) return toast.error("비밀번호는 8자 이상이어야 합니다");
    if (next !== confirm) return toast.error("비밀번호가 일치하지 않습니다");
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) throw error;
      toast.success("비밀번호가 변경되었습니다");
      setNext("");
      setConfirm("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "변경 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader title="보안" />
      <div className="space-y-3 px-5 py-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <span className="text-[14px] font-bold">비밀번호 변경</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            로그인 계정: {user?.email ?? "—"}
          </p>
          <div className="mt-3 space-y-2">
            <Input
              label="새 비밀번호"
              type="password"
              value={next}
              onChange={setNext}
              placeholder="8자 이상"
            />
            <Input
              label="새 비밀번호 확인"
              type="password"
              value={confirm}
              onChange={setConfirm}
              placeholder="다시 입력"
            />
            <button
              onClick={change}
              disabled={busy}
              className="flex w-full items-center justify-center gap-1 rounded-xl bg-primary py-3 text-[14px] font-bold text-primary-foreground disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              비밀번호 변경
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success" />
            <span className="text-[14px] font-bold">2단계 인증 (예정)</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            OTP 기반 2단계 인증은 곧 제공될 예정입니다.
          </p>
        </div>
      </div>
    </PhoneShell>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</div>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-surface px-3 py-2.5 text-[13px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}
