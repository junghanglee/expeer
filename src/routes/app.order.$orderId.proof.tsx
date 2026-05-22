import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FileImage, Loader2, ShieldCheck, Upload } from "lucide-react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Section } from "@/components/espeer/Section";
import { markProofUploaded, useOrder } from "@/hooks/useOrders";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ProofRow {
  id: string;
  image_url: string;
  amount: number | null;
  note: string | null;
  created_at: string;
}

export const Route = createFileRoute("/app/order/$orderId/proof")({
  head: () => ({ meta: [{ title: "증빙 업로드 — EXPEER" }] }),
  component: Proof,
});

function demoProofs(orderId: string): ProofRow[] {
  if (!orderId.startsWith("demo-order-")) return [];
  return [
    {
      id: `${orderId}-proof-1`,
      image_url: "demo-bank-transfer-proof.png",
      amount: 250000,
      note: "테스트 입금증빙: 입금자명, 금액, 시간이 보이는 화면",
      created_at: new Date(Date.now() - 60_000).toISOString(),
    },
  ];
}

function Proof() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { order, refresh } = useOrder(orderId);
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const isDemo = orderId.startsWith("demo-order-");
  const isCryptoSwap = order?.ads?.kind === "crypto_swap";
  const title = isCryptoSwap ? "교환 증빙 업로드" : "입금증 업로드";
  const emptyCta = isCryptoSwap ? "전송/수령 증빙 첨부" : "입금증 첨부";
  const successText = isCryptoSwap ? "교환 증빙이 제출되었습니다." : "입금증빙이 제출되었습니다.";

  const loadProofs = useCallback(async () => {
    if (isDemo) {
      setProofs(demoProofs(orderId));
      return;
    }
    const { data } = await supabase
      .from("payment_proofs")
      .select("id,image_url,amount,note,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    setProofs(data ?? []);
  }, [isDemo, orderId]);

  useEffect(() => {
    loadProofs();
  }, [loadProofs]);

  const handleUpload = async (file?: File) => {
    if (isDemo) {
      await markProofUploaded(orderId);
      await refresh();
      toast.success("테스트 증빙이 추가된 것처럼 표시합니다.");
      setProofs((prev) => [
        {
          id: `${orderId}-proof-${Date.now()}`,
          image_url: file?.name || "demo-upload-proof.png",
          amount: order ? Number(order.fiat_amount) : null,
          note: note || "테스트 업로드 증빙",
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setNote("");
      return;
    }
    if (!file || !user || !order) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${orderId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;

      const amount = isCryptoSwap ? Number(order.amount) : Number(order.fiat_amount);
      const normalizedNote = [isCryptoSwap ? "[P2P교환 증빙]" : "[P2P환전 입금증]", note.trim()]
        .filter(Boolean)
        .join(" ");

      const { error: insErr } = await supabase.from("payment_proofs").insert({
        order_id: orderId,
        uploaded_by: user.id,
        image_url: path,
        amount,
        note: normalizedNote || null,
      });
      if (insErr) throw insErr;
      await markProofUploaded(orderId);
      toast.success(successText);
      setNote("");
      await refresh();
      await loadProofs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader title={title} subtitle={`주문 #${orderId.slice(-4)}`} />

      <Section>
        <div className="mb-3 rounded-2xl border border-primary bg-primary-soft p-3 text-[12px] leading-relaxed text-foreground">
          <ShieldCheck className="mr-1 inline h-4 w-4 text-primary" />
          {isCryptoSwap
            ? "지갑 주소, 전송 수량, tx hash가 보이는 화면을 첨부하면 분쟁 자료로 보존됩니다."
            : "입금자명, 입금 금액, 입금 시간이 보이는 화면을 첨부하면 분쟁 자료로 보존됩니다."}
        </div>
        {isDemo && (
          <div className="mb-3 rounded-2xl border border-success bg-success-soft p-3 text-[12px] font-semibold text-success">
            테스트 주문입니다. 실제 파일 저장 없이 증빙 흐름만 확인합니다.
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
        <button
          disabled={uploading}
          onClick={() => (isDemo ? handleUpload() : fileRef.current?.click())}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface py-12 text-muted-foreground disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <Upload className="h-7 w-7" />
          )}
          <div className="text-[13px] font-semibold text-foreground">
            {uploading ? "업로드 중..." : emptyCta}
          </div>
          <div className="text-[11px]">스크린샷 / 사진 / PDF</div>
        </button>
        <textarea
          placeholder={
            isCryptoSwap ? "tx hash, 지갑 주소, 전송 시간 메모" : "입금자명, 입금 시간 메모"
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] focus:outline-none"
        />
      </Section>

      {proofs.length > 0 && (
        <Section title={isCryptoSwap ? "제출된 교환 증빙" : "제출된 입금증"}>
          <div className="space-y-2">
            {proofs.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <FileImage className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-bold text-foreground">
                    {p.image_url.split("/").pop()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("ko-KR")}
                  </div>
                  {p.note && (
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                      {p.note}
                    </div>
                  )}
                </div>
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">
                  완료
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section>
        <button
          onClick={() => navigate({ to: "/app/order/$orderId", params: { orderId } })}
          className="block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground"
        >
          주문 화면으로
        </button>
      </Section>
    </PhoneShell>
  );
}
