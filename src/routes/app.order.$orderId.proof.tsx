import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Section } from "@/components/espeer/Section";
import { Upload, FileImage, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useOrder, markProofUploaded } from "@/hooks/useOrders";
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
  head: () => ({ meta: [{ title: "입금증 업로드 — EXPEER" }] }),
  component: Proof,
});

function Proof() {
  const { orderId } = Route.useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { order } = useOrder(orderId);
  const [proofs, setProofs] = useState<ProofRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadProofs = async () => {
    const { data } = await supabase
      .from("payment_proofs")
      .select("id,image_url,amount,note,created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    setProofs(data ?? []);
  };

  useEffect(() => {
    loadProofs();
  }, [orderId]);

  const handleUpload = async (file: File) => {
    if (!user || !order) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${orderId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("payment-proofs")
        .upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { error: insErr } = await supabase.from("payment_proofs").insert({
        order_id: orderId,
        uploaded_by: user.id,
        image_url: path,
        amount: order.fiat_amount,
        note: note || null,
      });
      if (insErr) throw insErr;
      await markProofUploaded(orderId);
      toast.success("입금증이 제출되었습니다");
      setNote("");
      await loadProofs();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader title="입금증 업로드" subtitle={`주문 #${orderId.slice(-4)}`} />

      <Section>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
          }}
        />
        <button
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface py-12 text-muted-foreground disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <Upload className="h-7 w-7" />
          )}
          <div className="text-[13px] font-semibold text-foreground">
            {uploading ? "업로드 중…" : "탭하여 입금증 첨부"}
          </div>
          <div className="text-[11px]">스크린샷 / 사진 / PDF (최대 10MB)</div>
        </button>
        <textarea
          placeholder="메모 (선택)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-2 text-[12px] focus:outline-none"
        />
      </Section>

      {proofs.length > 0 && (
        <Section title="제출된 입금증">
          <div className="space-y-2">
            {proofs.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <FileImage className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-foreground">
                    {p.image_url.split("/").pop()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString("ko-KR")}
                  </div>
                </div>
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">
                  완료
                </span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {proofs.length > 0 && (
        <Section>
          <button
            onClick={() => navigate({ to: "/app/order/$orderId", params: { orderId } })}
            className="block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground"
          >
            주문 화면으로
          </button>
        </Section>
      )}
    </PhoneShell>
  );
}
