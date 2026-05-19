import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "비밀번호 재설정 — EXPEER" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError("비밀번호는 최소 8자 이상이어야 합니다.");
    if (password !== confirm) return setError("비밀번호가 일치하지 않습니다.");

    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
    setTimeout(() => navigate({ to: "/onboarding/login" }), 1500);
  };

  return (
    <div className="phone-shell">
      <div className="phone-canvas px-5 pb-10 pt-12">
        <h1 className="text-[28px] font-extrabold leading-tight text-foreground">
          새 비밀번호 설정
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">새로운 비밀번호를 입력해주세요.</p>

        {done ? (
          <div className="mt-8 rounded-xl bg-success-soft px-4 py-4 text-[13px] text-success">
            비밀번호가 변경되었습니다. 잠시 후 로그인 페이지로 이동합니다.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-2.5">
            <Field
              placeholder="새 비밀번호 (8자 이상)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Field
              placeholder="비밀번호 확인"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />

            {error && (
              <div className="rounded-lg bg-destructive-soft px-3 py-2 text-[12px] font-semibold text-destructive">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-3 block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground disabled:opacity-60"
            >
              {loading ? "변경 중…" : "비밀번호 변경"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-3">
      <Lock className="h-4 w-4 text-muted-foreground" />
      <input
        type="password"
        required
        minLength={8}
        autoComplete="new-password"
        {...props}
        className="flex-1 bg-transparent text-[14px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}
