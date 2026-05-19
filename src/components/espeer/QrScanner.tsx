import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { Camera, X, Loader2 } from "lucide-react";

/**
 * QR 코드 스캐너 — 카메라로 지갑 주소 QR을 읽어 주소 문자열 반환.
 * EIP-681(이더리움) / 비트코인 URI도 파싱하여 순수 주소만 추출.
 */
export function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let raf = 0;

    const tick = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(img.data, img.width, img.height, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            const cleaned = parseQrAddress(code.data);
            cancelled = true;
            streamRef.current?.getTracks().forEach((t) => t.stop());
            onScan(cleaned);
            return;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setReady(true);
          raf = requestAnimationFrame(tick);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "카메라를 사용할 수 없습니다.");
      }
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-[14px] font-extrabold">
            <Camera className="h-4 w-4 text-primary" /> QR 스캔
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="relative bg-black">
          {error ? (
            <div className="p-6 text-center text-[12px] text-destructive">{error}</div>
          ) : (
            <>
              <video ref={videoRef} playsInline muted className="h-72 w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />
              {!ready && (
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              <div className="pointer-events-none absolute inset-8 rounded-xl border-2 border-primary/70" />
            </>
          )}
        </div>
        <p className="px-4 py-2 text-center text-[11px] text-muted-foreground">
          QR 코드를 사각형 안에 맞춰주세요
        </p>
      </div>
    </div>
  );
}

function parseQrAddress(data: string): string {
  const trimmed = data.trim();
  // ethereum:0xABC...@1?value=...  → 0xABC...
  const eth = trimmed.match(/^ethereum:([^@?]+)/i);
  if (eth) return eth[1];
  // bitcoin:bc1...?amount=...
  const btc = trimmed.match(/^bitcoin:([^?]+)/i);
  if (btc) return btc[1];
  // solana:..., tron:T...
  const generic = trimmed.match(/^[a-z]+:([^?@]+)/i);
  if (generic && trimmed.includes(":")) return generic[1];
  return trimmed;
}
