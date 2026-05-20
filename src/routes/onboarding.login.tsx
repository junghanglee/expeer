import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/onboarding/login")({
  head: () => ({ meta: [{ title: "로그인 — EXPEER" }] }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = window.localStorage.getItem("expeer.login.email");
    if (savedEmail) setEmail(savedEmail);
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: "/app" });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) {
      setError(
        err.message === "Invalid login credentials"
          ? "이메일 또는 비밀번호가 올바르지 않습니다. 회원가입한 계정으로 다시 시도하세요."
          : err.message,
      );
      return;
    }
    if (remember) {
      window.localStorage.setItem("expeer.login.email", email);
    } else {
      window.localStorage.removeItem("expeer.login.email");
    }
    navigate({ to: "/app" });
  };

  return (
    <div className="phone-shell">
      <div className="phone-canvas px-5 pb-10 pt-12">
        <h1 className="text-[28px] font-extrabold leading-tight text-foreground">
          EXPEER에 오신 걸<br />
          환영합니다
        </h1>
        <p className="mt-2 text-[13px] text-muted-foreground">
          로그인하고 안전한 거래를 시작하세요.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-2.5">
          <Field
            icon={Mail}
            placeholder="you@example.com"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Field
            icon={Lock}
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          <label className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2.5 text-[12px] font-semibold text-foreground/80">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            이 브라우저에 이메일 저장
          </label>

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
            {loading ? "로그인 중…" : "로그인"}
          </button>
        </form>

        <div className="mt-3 flex items-center justify-between text-[12px]">
          <Link to="/onboarding/signup" className="font-semibold text-primary">
            회원가입
          </Link>
          <Link to="/onboarding/forgot-password" className="font-semibold text-muted-foreground">
            비밀번호 찾기
          </Link>
        </div>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  ...props
}: { icon: typeof Mail } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface px-3 py-3">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <input
        {...props}
        className="flex-1 bg-transparent text-[14px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}
