import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyableField({
  label,
  value,
  mono = true,
  big = false,
}: {
  label?: string;
  value: string;
  mono?: boolean;
  big?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 rounded-xl bg-surface px-3 py-2.5">
      <div className="min-w-0 flex-1">
        {label && <div className="text-[11px] text-muted-foreground">{label}</div>}
        <div
          className={`truncate ${mono ? "num-tnum" : ""} ${
            big ? "text-lg font-bold" : "text-sm font-semibold"
          } text-foreground`}
        >
          {value}
        </div>
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="flex h-8 items-center gap-1 rounded-lg bg-background px-2.5 text-[12px] font-semibold text-primary border border-border hover:bg-primary-soft"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? "복사됨" : "복사"}
      </button>
    </div>
  );
}
