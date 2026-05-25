import type { ReactNode } from "react";

export function BigNumber({
  value,
  unit,
  caption,
  size = "lg",
  tone = "default",
}: {
  value: ReactNode;
  unit?: string;
  caption?: string;
  size?: "md" | "lg" | "xl";
  tone?: "default" | "primary" | "success" | "danger";
}) {
  const sizeCls =
    size === "xl" ? "text-[40px] leading-[1.1]" : size === "lg" ? "text-3xl" : "text-2xl";
  const toneCls =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success"
        : tone === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="min-w-0 overflow-hidden">
      <div className={`num-display min-w-0 break-words ${sizeCls} ${toneCls}`}>
        {value}
        {unit && <span className="ml-1 break-words text-base font-bold text-muted-foreground">{unit}</span>}
      </div>
      {caption && <div className="mt-1 break-words text-[12px] text-muted-foreground">{caption}</div>}
    </div>
  );
}
