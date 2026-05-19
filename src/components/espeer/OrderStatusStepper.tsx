import type { Enums } from "@/integrations/supabase/types";

type OrderStatus = Enums<"order_status">;

const STEPS: { key: OrderStatus; label: string; sub: string }[] = [
  { key: "created", label: "주문", sub: "생성" },
  { key: "paid", label: "송금", sub: "법정통화" },
  { key: "proof_uploaded", label: "증빙", sub: "업로드" },
  { key: "released", label: "릴리즈", sub: "코인 전송" },
  { key: "completed", label: "완료", sub: "거래 종료" },
];

const ORDER: OrderStatus[] = [
  "created",
  "info_shared",
  "paid",
  "proof_uploaded",
  "confirmed",
  "released",
  "completed",
];

function indexFor(status: OrderStatus): number {
  // map raw status into the visible 5-step model
  switch (status) {
    case "created":
    case "info_shared":
      return 0;
    case "paid":
      return 1;
    case "proof_uploaded":
    case "confirmed":
      return 2;
    case "released":
      return 3;
    case "completed":
      return 4;
    default:
      return Math.max(0, ORDER.indexOf(status));
  }
}

export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  const isDispute = status === "disputed";
  const isCancelled = status === "cancelled" || status === "expired";
  const idx = isDispute ? 2 : indexFor(status);
  return (
    <div className="px-4 pb-4 pt-3">
      <div className="flex items-center gap-1">
        {STEPS.map((s, i) => {
          const reached = !isDispute && !isCancelled && i <= idx;
          const isCurrent = !isDispute && !isCancelled && i === idx;
          return (
            <div key={s.key} className="flex flex-1 items-center gap-1">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                    isDispute && i === 2
                      ? "bg-destructive text-destructive-foreground"
                      : reached
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface-strong text-muted-foreground"
                  } ${isCurrent ? "ring-4 ring-primary-soft" : ""}`}
                >
                  {i + 1}
                </div>
                <span
                  className={`text-[10px] font-bold leading-tight ${
                    reached ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {s.label}
                </span>
                <span
                  className={`text-[8.5px] font-medium leading-tight ${
                    reached ? "text-primary" : "text-muted-foreground/60"
                  }`}
                >
                  {s.sub}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`mb-5 h-[2px] flex-1 rounded-full ${
                    reached && !isCurrent ? "bg-primary" : "bg-surface-strong"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
