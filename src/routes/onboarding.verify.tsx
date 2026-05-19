import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Section } from "@/components/espeer/Section";
import { CameraCapture } from "@/components/espeer/CameraCapture";
import { useServerFn } from "@tanstack/react-start";
import { ocrIdCard, verifyFaceMatch } from "@/utils/kyc.functions";
import { Check, Loader2, ShieldCheck, ScanLine } from "lucide-react";

export const Route = createFileRoute("/onboarding/verify")({
  head: () => ({ meta: [{ title: "환전 계좌인증 — EXPEER" }] }),
  component: VerifyPage,
});

type Step = "intro" | "id" | "selfie" | "review" | "done";

function VerifyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile, refresh } = useProfile();

  const ocrFn = useServerFn(ocrIdCard);
  const matchFn = useServerFn(verifyFaceMatch);

  const [step, setStep] = useState<Step>("intro");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [idBase64, setIdBase64] = useState<string>("");
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfieBase64, setSelfieBase64] = useState<string>("");

  const [ocrLoading, setOcrLoading] = useState(false);
  const [matchLoading, setMatchLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [extracted, setExtracted] = useState<{
    fullName: string;
    idNumber: string;
    idType: string;
    birthDate: string;
  } | null>(null);
  const [matchResult, setMatchResult] = useState<{
    matched: boolean;
    confidence: number;
    reason: string;
  } | null>(null);

  if (profile?.kyc_status === "approved") {
    return (
      <PhoneShell hideTab>
        <AppHeader title="환전 계좌인증" />
        <div className="px-5 pt-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground">
            <Check className="h-7 w-7" />
          </div>
          <div className="mt-3 text-[15px] font-extrabold">이미 인증되었습니다</div>
          <button
            onClick={() => navigate({ to: "/app/profile" })}
            className="mt-6 w-full rounded-xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground"
          >
            프로필로
          </button>
        </div>
      </PhoneShell>
    );
  }

  const onCaptureId = async (file: File, base64: string) => {
    setIdFile(file);
    setIdBase64(base64);
    setOcrLoading(true);
    try {
      const result = await ocrFn({ data: { imageBase64: base64, mimeType: file.type } });
      if (!result.ok) {
        toast.error(result.error ?? "OCR 실패");
        return;
      }
      setExtracted({
        fullName: result.fullName ?? "",
        idNumber: result.idNumber ?? "",
        idType: result.idType ?? "주민등록증",
        birthDate: result.birthDate ?? "",
      });
      toast.success("신분증 정보를 자동 추출했습니다");
      setStep("selfie");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "OCR 오류");
    } finally {
      setOcrLoading(false);
    }
  };

  const onCaptureSelfie = async (file: File, base64: string) => {
    setSelfieFile(file);
    setSelfieBase64(base64);
    setMatchLoading(true);
    try {
      const result = await matchFn({
        data: {
          idImageBase64: idBase64,
          selfieBase64: base64,
          mimeType: file.type,
        },
      });
      if (!result.ok) {
        toast.error(result.error ?? "얼굴 비교 실패");
        return;
      }
      setMatchResult({
        matched: !!result.matched,
        confidence: result.confidence ?? 0,
        reason: result.reason ?? "",
      });
      setStep("review");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "얼굴 비교 오류");
    } finally {
      setMatchLoading(false);
    }
  };

  const submit = async () => {
    if (!user || !idFile || !selfieFile || !extracted) return;
    setSubmitting(true);
    try {
      const upload = async (file: File, kind: string) => {
        const path = `${user.id}/${kind}-${Date.now()}.jpg`;
        const { error } = await supabase.storage
          .from("kyc-documents")
          .upload(path, file, { upsert: false });
        if (error) throw error;
        return path;
      };
      const [front, self] = await Promise.all([
        upload(idFile, "id-front"),
        upload(selfieFile, "selfie"),
      ]);

      const autoApprove = matchResult?.matched && (matchResult?.confidence ?? 0) >= 0.7;

      const { error: kycErr } = await supabase.from("kyc_submissions").insert({
        user_id: user.id,
        full_name: extracted.fullName || "(미인식)",
        id_type: extracted.idType || "주민등록증",
        id_number: extracted.idNumber || "(미인식)",
        id_front_url: front,
        selfie_url: self,
        status: autoApprove ? "approved" : "pending",
      });
      if (kycErr) throw kycErr;

      await supabase
        .from("profiles")
        .update({
          kyc_status: autoApprove ? "approved" : "pending",
          kyc_level: autoApprove ? 2 : 1,
        })
        .eq("id", user.id);

      await refresh();
      toast.success(
        autoApprove ? "환전 계좌인증이 자동 승인되었습니다" : "인증이 접수되었습니다 (관리자 검토)",
      );
      setStep("done");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "제출 실패");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PhoneShell hideTab>
      <AppHeader title="환전 계좌인증" subtitle="카메라로 1분 안에 완료" />
      <div className="px-5 pb-24 pt-2">
        <Stepper step={step} />

        {step === "intro" && (
          <div className="space-y-4 pt-4">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <span className="text-[14px] font-extrabold">코인 매수에만 필요합니다</span>
              </div>
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                안전한 원화 송금을 위해 신분증 1회 촬영과 셀카 1장이 필요합니다. AI가 자동으로
                정보를 추출하고 본인 여부를 확인합니다.
              </p>
            </div>
            <ul className="space-y-1 text-[12px] text-muted-foreground">
              <li>· 신분증을 카메라에 비추면 자동 추출됩니다</li>
              <li>· 셀카로 본인 여부를 자동 확인합니다</li>
              <li>· 일치하면 즉시 승인, 불확실하면 관리자 검토</li>
            </ul>
            <button
              onClick={() => setStep("id")}
              className="block w-full rounded-xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground"
            >
              시작하기
            </button>
          </div>
        )}

        {step === "id" && (
          <Section title="① 신분증 촬영">
            <CameraCapture
              onCapture={onCaptureId}
              facing="environment"
              label={ocrLoading ? "분석 중…" : "신분증 촬영"}
              hint="신분증 전체가 보이도록 평평한 곳에 두고 촬영해 주세요."
            />
            {ocrLoading && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary-soft p-3 text-[12px] text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI가 신분증 정보를 추출하고 있어요…
              </div>
            )}
          </Section>
        )}

        {step === "selfie" && extracted && (
          <>
            <Section title="② 추출된 정보 확인">
              <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
                <Field
                  label="이름"
                  value={extracted.fullName}
                  onChange={(v) => setExtracted({ ...extracted, fullName: v })}
                />
                <Field
                  label="신분증 종류"
                  value={extracted.idType}
                  onChange={(v) => setExtracted({ ...extracted, idType: v })}
                />
                <Field
                  label="신분증 번호"
                  value={extracted.idNumber}
                  onChange={(v) => setExtracted({ ...extracted, idNumber: v })}
                />
                <Field
                  label="생년월일"
                  value={extracted.birthDate}
                  onChange={(v) => setExtracted({ ...extracted, birthDate: v })}
                />
              </div>
            </Section>
            <Section title="③ 셀카 촬영 (본인 확인)">
              <CameraCapture
                onCapture={onCaptureSelfie}
                facing="user"
                label={matchLoading ? "비교 중…" : "셀카 촬영"}
                hint="얼굴 전체가 화면 중앙에 들어오도록 촬영해 주세요."
              />
              {matchLoading && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-primary-soft p-3 text-[12px] text-primary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  AI가 본인 여부를 확인하고 있어요…
                </div>
              )}
            </Section>
          </>
        )}

        {step === "review" && extracted && matchResult && (
          <Section title="④ 결과 확인">
            <div className="space-y-3">
              <div
                className={`rounded-2xl border p-4 ${
                  matchResult.matched
                    ? "border-success bg-success-soft text-success"
                    : "border-warning bg-warning-soft text-warning-foreground"
                }`}
              >
                <div className="flex items-center gap-2">
                  {matchResult.matched ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <ScanLine className="h-5 w-5" />
                  )}
                  <span className="text-[14px] font-extrabold">
                    {matchResult.matched ? "본인 확인 완료" : "추가 검토 필요"}
                  </span>
                </div>
                <div className="mt-1 text-[11px]">
                  신뢰도 {(matchResult.confidence * 100).toFixed(0)}% · {matchResult.reason}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-card p-3 text-[12px]">
                <Row k="이름" v={extracted.fullName} />
                <Row k="신분증" v={extracted.idType} />
                <Row k="번호" v={extracted.idNumber} />
                <Row k="생년월일" v={extracted.birthDate} />
              </div>
              <button
                onClick={submit}
                disabled={submitting}
                className="block w-full rounded-xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground disabled:opacity-50"
              >
                {submitting ? "제출 중…" : "인증 제출"}
              </button>
            </div>
          </Section>
        )}

        {step === "done" && (
          <div className="pt-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground">
              <Check className="h-7 w-7" />
            </div>
            <div className="mt-3 text-[15px] font-extrabold">제출 완료</div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              {(profile?.kyc_status as string) === "approved"
                ? "이제 코인을 매수할 수 있습니다."
                : "관리자 검토 후 알림드립니다."}
            </p>
            <button
              onClick={() => navigate({ to: "/app/profile" })}
              className="mt-6 w-full rounded-xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground"
            >
              프로필로 이동
            </button>
          </div>
        )}
      </div>
    </PhoneShell>
  );
}

function Stepper({ step }: { step: Step }) {
  const order: Step[] = ["intro", "id", "selfie", "review", "done"];
  const idx = order.indexOf(step);
  return (
    <div className="flex gap-1 pt-2">
      {order.slice(1).map((_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-full ${i < idx ? "bg-primary" : "bg-surface-strong"}`}
        />
      ))}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[10px] font-semibold text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg bg-surface px-3 py-2 text-[13px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 last:border-b-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-bold text-foreground">{v || "—"}</span>
    </div>
  );
}
