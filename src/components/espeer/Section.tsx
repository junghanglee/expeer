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
    <section className={`px-4 py-3 ${className ?? ""}`}>
      {(title || action) && (
        <div className="mb-2.5 flex items-center justify-between">
          {title && <h2 className="text-[15px] font-bold text-foreground">{title}</h2>}
          {action}
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
    <div className="flex items-center justify-between py-2">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className={`text-[13px] font-semibold ${t}`}>{value}</span>
    </div>
  );
}
