import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding/forgot-password")({
  head: () => ({ meta: [{ title: "비밀번호 찾기 — EXPEER" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSent(true);
  };

  return (
    <div className="phone-shell">
      <div className="phone-canvas px-5 pb-10 pt-12">
        <h1 className="text-[28px] font-extrabold leading-tight text-foreground">비밀번호 찾기</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          이메일로 재설정 링크를 보내드릴게요.
        </p>

        {sent ? (
          <div className="mt-8 rounded-xl bg-success-soft px-4 py-4 text-[13px] text-success">
            <strong>{email}</strong> 으로 재설정 링크를 보냈습니다. 메일함을 확인해주세요.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-8 space-y-2.5">
            <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-3">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <input
                type="email"
                placeholder="가입하신 이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="flex-1 bg-transparent text-[14px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
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
              {loading ? "전송 중…" : "재설정 링크 보내기"}
            </button>
          </form>
        )}

        <div className="mt-4 text-center text-[12px]">
          <Link to="/onboarding/login" className="font-semibold text-muted-foreground">
            로그인으로 돌아가기
          </Link>
        </div>
      </div>
    </div>
  );
}
