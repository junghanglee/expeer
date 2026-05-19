import { createFileRoute } from "@tanstack/react-router";
import { AdminShell } from "./expeeradmin.dashboard";
import { Check, Clock, Info, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useEvidencePackage } from "@/hooks/useEvidencePackage";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/expeeradmin/disputes/$id")({
  head: () => ({ meta: [{ title: "분쟁 자료 조회 — EXPEER" }] }),
  component: DisputeDetail,
});

type Dispute = Tables<"disputes">;
type Order = Tables<"orders">;
type Message = Tables<"messages">;
type Proof = Tables<"payment_proofs">;
type Transfer = Tables<"transfers">;
type EvidencePkg = Tables<"evidence_packages">;

function DisputeDetail() {
  const { id } = Route.useParams();
  const [dispute, setDispute] = useState<Dispute | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [pkgLogs, setPkgLogs] = useState<EvidencePkg[]>([]);
  const [loading, setLoading] = useState(true);
  const { download, loading: dlLoading } = useEvidencePackage();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data: d } = await supabase.from("disputes").select("*").eq("id", id).maybeSingle();
      setDispute(d);
      if (d?.order_id) {
        const [{ data: o }, { data: m }, { data: p }, { data: t }, { data: pk }] =
          await Promise.all([
            supabase.from("orders").select("*").eq("id", d.order_id).maybeSingle(),
            supabase.from("messages").select("*").eq("order_id", d.order_id).order("created_at"),
            supabase.from("payment_proofs").select("*").eq("order_id", d.order_id),
            supabase.from("transfers").select("*").eq("order_id", d.order_id),
            supabase
              .from("evidence_packages")
              .select("*")
              .eq("order_id", d.order_id)
              .order("created_at", { ascending: false }),
          ]);
        setOrder(o);
        setMessages(m ?? []);
        setProofs(p ?? []);
        setTransfers(t ?? []);
        setPkgLogs(pk ?? []);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <AdminShell title="분쟁 자료 조회">
        <div className="text-muted-foreground">로딩 중...</div>
      </AdminShell>
    );
  }
  if (!dispute) {
    return (
      <AdminShell title="분쟁 자료 조회">
        <div className="text-muted-foreground">존재하지 않는 분쟁입니다.</div>
      </AdminShell>
    );
  }

  return (
    <AdminShell title={`자료 조회 #${dispute.id.slice(0, 8)}`}>
      {/* 정책 고지 */}
      <div className="mb-4 rounded-2xl border border-primary bg-primary-soft p-4">
        <div className="flex items-start gap-2">
          <Info className="h-5 w-5 shrink-0 text-primary" />
          <div className="text-[13px] leading-relaxed text-foreground">
            <b>EXPEER는 P2P 중개 플랫폼으로 분쟁을 직접 중재·판정하지 않습니다.</b>
            <br />본 화면은 보존된 거래 자료를 조회·발급하기 위한 용도이며, 당사자 간 협의 또는 관련
            당국 절차 지원 외의 행위는 수행하지 않습니다.
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3">
          <Panel title="신청 정보">
            <Row label="분쟁 ID" value={dispute.id} />
            <Row label="상태" value={dispute.status} />
            <Row label="사유" value={dispute.reason} />
            <Row label="신청자 ID" value={dispute.opener_id} />
            <Row label="접수 시각" value={new Date(dispute.created_at).toLocaleString("ko-KR")} />
            {dispute.description && (
              <div className="mt-2 rounded-xl bg-surface p-3 text-[12px] text-foreground whitespace-pre-wrap">
                {dispute.description}
              </div>
            )}
          </Panel>

          {order && (
            <Panel title="주문 정보">
              <Row label="주문 ID" value={order.id} />
              <Row label="상태" value={order.status} />
              <Row label="자산" value={`${order.amount} ${order.asset} (${order.network})`} />
              <Row
                label="법정통화 금액"
                value={`${Number(order.fiat_amount).toLocaleString()} ${order.fiat}`}
              />
              <Row label="구매자" value={order.buyer_id} />
              <Row label="판매자" value={order.seller_id} />
              <Row label="생성 시각" value={new Date(order.created_at).toLocaleString("ko-KR")} />
            </Panel>
          )}

          <Panel title="송금 증빙">
            {proofs.length === 0 ? (
              <div className="text-[12px] text-muted-foreground">증빙 없음</div>
            ) : (
              <ul className="space-y-2">
                {proofs.map((p) => (
                  <li
                    key={p.id}
                    className="rounded-xl border border-border bg-surface p-2 text-[12px]"
                  >
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        업로드 {new Date(p.created_at).toLocaleString("ko-KR")}
                      </span>
                      <span className={p.confirmed_at ? "text-success" : "text-warning"}>
                        {p.confirmed_at ? "확인됨" : "미확인"}
                      </span>
                    </div>
                    {p.note && <div className="mt-1 text-foreground">{p.note}</div>}
                    <a
                      href={p.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate text-primary underline"
                    >
                      {p.image_url}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-3">
          <Panel title="채팅 로그 (전체)">
            <div className="max-h-[400px] space-y-1.5 overflow-y-auto text-[12px]">
              {messages.length === 0 ? (
                <div className="text-muted-foreground">메시지 없음</div>
              ) : (
                messages.map((m) => {
                  const role =
                    m.sender_id === order?.buyer_id
                      ? "BUYER"
                      : m.sender_id === order?.seller_id
                        ? "SELLER"
                        : "SYS";
                  return (
                    <div key={m.id}>
                      <span className="font-bold text-muted-foreground">[{role}]</span>{" "}
                      <span className="text-foreground">{m.content}</span>
                      <span className="ml-1 text-[10px] text-muted-foreground">
                        {new Date(m.created_at).toLocaleTimeString("ko-KR")}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </Panel>

          <Panel title="온체인 이체">
            {transfers.length === 0 ? (
              <div className="text-[12px] text-muted-foreground">이체 내역 없음</div>
            ) : (
              <ul className="space-y-1.5 text-[12px]">
                {transfers.map((t) => (
                  <li key={t.id} className="rounded-xl bg-surface p-2">
                    <div className="text-foreground">
                      {t.amount} {t.asset} → {t.to_address.slice(0, 8)}...{t.to_address.slice(-6)}
                    </div>
                    {t.tx_hash && (
                      <div className="text-[10px] text-muted-foreground">tx: {t.tx_hash}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="자료 패키지 발급 이력">
            {pkgLogs.length === 0 ? (
              <div className="text-[12px] text-muted-foreground">발급 이력 없음</div>
            ) : (
              <ul className="space-y-1 text-[12px]">
                {pkgLogs.map((l) => (
                  <li key={l.id} className="flex items-center justify-between">
                    <span className="text-foreground">{l.requested_by.slice(0, 8)}</span>
                    <span className="text-muted-foreground">
                      {new Date(l.created_at).toLocaleString("ko-KR")} ·{" "}
                      {l.file_size_bytes
                        ? `${(Number(l.file_size_bytes) / 1024).toFixed(1)} KB`
                        : "-"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {order && (
              <button
                onClick={() => download(order.id)}
                disabled={dlLoading}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary-soft py-2.5 text-[12px] font-bold text-primary disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                {dlLoading ? "생성 중..." : "관리용 자료 패키지 다운로드"}
              </button>
            )}
          </Panel>
        </div>
      </div>
    </AdminShell>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <h3 className="mb-2 text-[13px] font-bold text-foreground">{title}</h3>
      {children}
    </div>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[12px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="truncate font-semibold text-foreground">{value}</span>
    </div>
  );
}
// Reserved for future timeline rendering
export const _Tl = ({ label, ts, ok }: { label: string; ts: string; ok?: boolean }) => (
  <li className="flex items-start gap-2">
    <span
      className={`mt-1 flex h-4 w-4 items-center justify-center rounded-full ${ok ? "bg-success-soft text-success" : "bg-surface-strong text-muted-foreground"}`}
    >
      {ok ? <Check className="h-2.5 w-2.5" /> : <Clock className="h-2.5 w-2.5" />}
    </span>
    <div className="flex-1">
      <div className="font-semibold text-foreground">{label}</div>
      <div className="text-[11px] text-muted-foreground">{ts}</div>
    </div>
  </li>
);
