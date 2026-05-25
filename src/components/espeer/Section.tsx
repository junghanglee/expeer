import type { ReactNode } from "react";

export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`min-w-0 px-4 py-3 ${className ?? ""}`}>
      {(title || action) && (
        <div className="mb-2.5 flex min-w-0 items-start justify-between gap-2">
          {title && <h2 className="min-w-0 break-words text-[15px] font-bold text-foreground">{title}</h2>}
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export function InfoRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "danger" | "success";
}) {
  const t =
    tone === "danger"
      ? "text-destructive"
      : tone === "success"
        ? "text-success"
        : "text-foreground";
  return (
    <div className="flex min-w-0 items-start justify-between gap-2 py-2">
      <span className="min-w-0 break-words text-[13px] text-muted-foreground">{label}</span>
      <span className={`min-w-0 break-words text-right text-[13px] font-semibold ${t}`}>{value}</span>
    </div>
  );
}
