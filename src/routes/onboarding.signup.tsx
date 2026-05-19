import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Mail, Lock, User } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/onboarding/signup")({
  head: () => ({ meta: [{ title: "회원가입 — EXPEER" }] }),
  component: Signup,
});

function Signup() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [nickname, setNickname] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) return setError("비밀번호는 최소 8자 이상이어야 합니다.");
    if (password !== confirm) return setError("비밀번호가 일치하지 않습니다.");

    setLoading(true);
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/app`,
        data: { nickname: nickname || email.split("@")[0] },
      },
    });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }
    navigate({ to: "/app" });
  };

  return (
    <div className="phone-shell">
      <div className="phone-canvas px-5 pb-10 pt-12">
        <h1 className="text-[28px] font-extrabold leading-tight text-foreground">회원가입</h1>
        <p className="mt-2 text-[13px] text-muted-foreground">EXPEER 계정을 만드세요.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-2.5">
          <Field
            icon={Mail}
            placeholder="이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Field
            icon={User}
            placeholder="닉네임"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
          <Field
            icon={Lock}
            placeholder="비밀번호 (8자 이상)"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <Field
            icon={Lock}
            placeholder="비밀번호 확인"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
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
            {loading ? "가입 중…" : "가입하기"}
          </button>
        </form>

        <div className="mt-4 text-center text-[12px] text-muted-foreground">
          이미 계정이 있으신가요?{" "}
          <Link to="/onboarding/login" className="font-semibold text-primary">
            로그인
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
