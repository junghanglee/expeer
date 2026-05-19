import { useEffect, useRef, useState } from "react";
import { Camera, RotateCcw, Check, Loader2 } from "lucide-react";

export function CameraCapture({
  onCapture,
  facing = "environment",
  label = "촬영",
  hint,
}: {
  onCapture: (file: File, base64: string) => void;
  facing?: "user" | "environment";
  label?: string;
  hint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
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
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "카메라 권한이 필요합니다. 브라우저 설정에서 허용해 주세요.",
        );
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [facing]);

  const snap = async () => {
    if (!videoRef.current) return;
    setBusy(true);
    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 720;
      canvas.height = video.videoHeight || 1280;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      setPreview(dataUrl);
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: "image/jpeg" });
      const base64 = dataUrl.split(",")[1] ?? "";
      onCapture(file, base64);
    } finally {
      setBusy(false);
    }
  };

  const retake = () => setPreview(null);

  if (error) {
    return (
      <div className="rounded-xl border border-destructive bg-destructive-soft p-4 text-[12px] text-destructive">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative overflow-hidden rounded-2xl bg-black">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="preview" className="h-64 w-full object-cover" />
        ) : (
          <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
        )}
        {!ready && !preview && (
          <div className="absolute inset-0 flex items-center justify-center text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      <div className="flex gap-2">
        {preview ? (
          <button
            onClick={retake}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-surface py-3 text-[13px] font-bold text-foreground"
          >
            <RotateCcw className="h-4 w-4" /> 다시 촬영
          </button>
        ) : (
          <button
            onClick={snap}
            disabled={!ready || busy}
            className="flex-1 inline-flex items-center justify-center gap-1 rounded-xl bg-primary py-3 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            {label}
          </button>
        )}
        {preview && (
          <span className="inline-flex items-center gap-1 rounded-xl bg-success-soft px-3 text-[12px] font-bold text-success">
            <Check className="h-4 w-4" /> 촬영 완료
          </span>
        )}
      </div>
    </div>
  );
}
