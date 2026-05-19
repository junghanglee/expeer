import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { buildEvidencePackage } from "@/utils/evidence.functions";
import { toast } from "sonner";

export function useEvidencePackage() {
  const fn = useServerFn(buildEvidencePackage);
  const [loading, setLoading] = useState(false);

  const download = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await fn({ data: { orderId } });
      // base64 → Blob
      const binary = atob(res.contentBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success(`증빙 패키지 다운로드 완료 (${(res.sizeBytes / 1024).toFixed(1)} KB)`);
    } catch (e: any) {
      toast.error(e.message ?? "패키지 생성 실패");
    } finally {
      setLoading(false);
    }
  };

  return { download, loading };
}
