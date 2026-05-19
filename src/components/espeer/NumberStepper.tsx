import { Minus, Plus } from "lucide-react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
  placeholder?: string;
  disabled?: boolean;
  inputClassName?: string;
  ariaLabel?: string;
}

/**
 * 숫자 입력 + −/+ 버튼이 양옆에 붙은 스테퍼.
 * 클릭마다 step(기본 1)씩 증감되고, 직접 타이핑도 가능.
 */
export function NumberStepper({
  value,
  onChange,
  step = 1,
  min,
  max,
  unit,
  placeholder,
  disabled,
  inputClassName,
  ariaLabel,
}: Props) {
  const clamp = (n: number) => {
    if (min !== undefined && n < min) return min;
    if (max !== undefined && n > max) return max;
    return n;
  };
  const bump = (dir: 1 | -1) => {
    const current = Number(value);
    const base = Number.isFinite(current) ? current : 0;
    // step이 정수면 결과도 정수로 정리(부동소수 노이즈 방지)
    const next = clamp(base + dir * step);
    const fixed = Number.isInteger(step) ? Math.round(next) : Number(next.toFixed(6));
    onChange(String(fixed));
  };

  const btn =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-foreground transition-colors hover:bg-primary hover:text-primary-foreground active:scale-95 disabled:opacity-40 disabled:hover:bg-surface disabled:hover:text-foreground";

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        aria-label={`${ariaLabel ?? "값"} 감소`}
        onClick={() => bump(-1)}
        disabled={disabled}
        className={btn}
      >
        <Minus className="h-4 w-4" />
      </button>
      <div
        className={`flex flex-1 items-center gap-1.5 rounded-xl border px-3 py-2 ${
          disabled
            ? "border-border bg-surface"
            : "border-border bg-card focus-within:border-primary"
        }`}
      >
        <input
          inputMode="decimal"
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.-]/g, ""))}
          className={`num-display w-full bg-transparent text-[15px] text-foreground outline-none disabled:text-muted-foreground ${inputClassName ?? ""}`}
        />
        {unit && <span className="text-[11px] font-bold text-muted-foreground">{unit}</span>}
      </div>
      <button
        type="button"
        aria-label={`${ariaLabel ?? "값"} 증가`}
        onClick={() => bump(1)}
        disabled={disabled}
        className={btn}
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}
