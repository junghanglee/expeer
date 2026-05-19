import { createFileRoute } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { useEffect, useState } from "react";
import { Sun, Moon, Monitor } from "lucide-react";

export const Route = createFileRoute("/app/settings/appearance")({
  head: () => ({ meta: [{ title: "언어 / 테마 — EXPEER" }] }),
  component: Appearance,
});

type Theme = "light" | "dark" | "system";
const THEME_KEY = "expeer.theme";
const LANG_KEY = "expeer.lang";

const LANGS = [
  { code: "ko", label: "한국어" },
  { code: "en", label: "English" },
  { code: "ja", label: "日本語" },
];

function applyTheme(t: Theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = t === "dark" || (t === "system" && prefersDark);
  root.classList.toggle("dark", dark);
}

function Appearance() {
  const [theme, setTheme] = useState<Theme>("system");
  const [lang, setLang] = useState("ko");

  useEffect(() => {
    const t = (window.localStorage.getItem(THEME_KEY) as Theme | null) ?? "system";
    const l = window.localStorage.getItem(LANG_KEY) ?? "ko";
    setTheme(t);
    setLang(l);
  }, []);

  const pickTheme = (t: Theme) => {
    setTheme(t);
    window.localStorage.setItem(THEME_KEY, t);
    applyTheme(t);
  };
  const pickLang = (l: string) => {
    setLang(l);
    window.localStorage.setItem(LANG_KEY, l);
  };

  return (
    <PhoneShell hideTab>
      <AppHeader title="언어 / 테마" />
      <div className="space-y-4 px-5 py-3">
        <section>
          <div className="mb-2 text-[11px] font-bold text-muted-foreground">테마</div>
          <div className="grid grid-cols-3 gap-2">
            <ThemeBtn
              active={theme === "light"}
              onClick={() => pickTheme("light")}
              icon={<Sun className="h-4 w-4" />}
              label="라이트"
            />
            <ThemeBtn
              active={theme === "dark"}
              onClick={() => pickTheme("dark")}
              icon={<Moon className="h-4 w-4" />}
              label="다크"
            />
            <ThemeBtn
              active={theme === "system"}
              onClick={() => pickTheme("system")}
              icon={<Monitor className="h-4 w-4" />}
              label="시스템"
            />
          </div>
        </section>

        <section>
          <div className="mb-2 text-[11px] font-bold text-muted-foreground">언어</div>
          <div className="space-y-1.5">
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => pickLang(l.code)}
                className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-[13px] font-bold ${
                  lang === l.code
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-border bg-card text-foreground"
                }`}
              >
                <span>{l.label}</span>
                {lang === l.code && <span className="text-[11px]">선택됨</span>}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            ※ 언어 변경은 다음 업데이트에서 전체 적용됩니다.
          </p>
        </section>
      </div>
    </PhoneShell>
  );
}

function ThemeBtn({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 rounded-2xl border py-3 text-[12px] font-bold ${
        active
          ? "border-primary bg-primary-soft text-primary"
          : "border-border bg-card text-foreground"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
