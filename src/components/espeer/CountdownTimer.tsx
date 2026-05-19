import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function CountdownTimer({
  totalSec = 15 * 60,
  className,
}: {
  totalSec?: number;
  className?: string;
}) {
  const [left, setLeft] = useState(totalSec);
  useEffect(() => {
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const m = Math.floor(left / 60);
  const s = left % 60;
  const danger = left < 60;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-semibold num-tnum ${
        danger ? "bg-destructive-soft text-destructive" : "bg-surface-strong text-foreground"
      } ${className ?? ""}`}
    >
      <Clock className="h-3.5 w-3.5" />
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </span>
  );
}
