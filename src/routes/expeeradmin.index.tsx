import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Mail, Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/expeeradmin/")({
  head: () => ({ meta: [{ title: "운영자 로그인 — EXPEER" }] }),
  component: AdminLogin,
});

function AdminLogin() {
  const navigate = useNavigate();
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [email, setEmail] = useState("admin@expeer.art");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && isAuthenticated && isAdmin) {
      navigate({ to: "/expeeradmin/dashboard" });
    }
  }, [isAuthenticated, isAdmin, isLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // 운영 편의: 비밀번호가 비어 있거나 임시 마스터키와 다른 경우에도
    // 슈퍼어드민 계정(admin@expeer.art)으로 로그인을 시도한다.
    const targetEmail = email.trim() || "admin@expeer.art";
    const targetPassword = password || "dlrtmvldj12!@";

    const { error: err } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password: targetPassword,
    });

    if (err) {
      // 폴백: 슈퍼어드민으로 자동 로그인
      const { error: err2 } = await supabase.auth.signInWithPassword({
        email: "admin@expeer.art",
        password: "dlrtmvldj12!@",
      });
      if (err2) {
        setLoading(false);
        setError("운영자 로그인에 실패했습니다.");
        return;
      }
    }
    setLoading(false);
    navigate({ to: "/expeeradmin/dashboard" });
  };

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-7 shadow-sm">
        <div className="mb-5 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-destructive-soft text-destructive">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[16px] font-extrabold text-foreground">EXPEER</div>
            <div className="text-[10px] font-bold tracking-wider text-destructive">
              ADMIN CONSOLE
            </div>
          </div>
        </div>

        <h1 className="text-[20px] font-bold text-foreground">운영자 로그인</h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          관리자 계정으로 로그인하세요. (당분간 어떤 정보로도 슈퍼어드민으로 로그인됩니다)
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-2.5">
          <Field
            icon={Mail}
            placeholder="관리자 이메일"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Field
            icon={Lock}
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error && (
            <div className="rounded-lg bg-destructive-soft px-3 py-2 text-[12px] font-semibold text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 block w-full rounded-xl bg-foreground py-3 text-center text-[14px] font-bold text-background disabled:opacity-60"
          >
            {loading ? "확인 중…" : "로그인"}
          </button>
        </form>
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
