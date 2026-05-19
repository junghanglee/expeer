import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Check, Upload, Loader2 } from "lucide-react";
import { useState, type ChangeEvent } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding/kyc")({
  head: () => ({ meta: [{ title: "실명 인증 — EXPEER" }] }),
  component: Kyc,
});

function Kyc() {
  const { user } = useAuth();
  const { profile, refresh } = useProfile();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState("주민등록증");
  const [idFront, setIdFront] = useState<File | null>(null);
  const [idBack, setIdBack] = useState<File | null>(null);
  const [selfie, setSelfie] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const uploadFile = async (file: File, kind: string) => {
    if (!user) throw new Error("로그인이 필요합니다");
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${kind}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("kyc-documents")
      .upload(path, file, { upsert: false });
    if (error) throw error;
    return path;
  };

  const submit = async () => {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    if (!fullName || !idNumber || !phone || !idFront || !idBack || !selfie) {
      toast.error("모든 항목을 입력하고 사진을 업로드해주세요");
      return;
    }
    setSubmitting(true);
    try {
      const [front, back, self] = await Promise.all([
        uploadFile(idFront, "id-front"),
        uploadFile(idBack, "id-back"),
        uploadFile(selfie, "selfie"),
      ]);

      // Update profile phone
      await supabase.from("profiles").update({ phone }).eq("id", user.id);

      // Insert KYC submission
      const { error: kycErr } = await supabase.from("kyc_submissions").insert({
        user_id: user.id,
        full_name: fullName,
        id_type: idType,
        id_number: idNumber,
        id_front_url: front,
        id_back_url: back,
        selfie_url: self,
        status: "pending",
      });
      if (kycErr) throw kycErr;

      // Mark profile kyc_status as pending
      await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user.id);

      await refresh();
      toast.success("KYC 신청이 접수되었습니다. 관리자 검토 후 알림드립니다.");
      navigate({ to: "/onboarding/bank" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "신청 실패";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (profile?.kyc_status === "approved") {
    return (
      <div className="phone-shell">
        <div className="phone-canvas">
          <AppHeader title="실명 인증" subtitle="2 / 4 단계" />
          <Progress step={2} />
          <div className="px-5 pt-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground">
              <Check className="h-7 w-7" />
            </div>
            <div className="mt-3 text-[15px] font-extrabold text-foreground">
              이미 승인되었습니다
            </div>
            <button
              onClick={() => navigate({ to: "/onboarding/bank" })}
              className="mt-6 w-full rounded-xl bg-primary py-3.5 text-[15px] font-bold text-primary-foreground"
            >
              다음 단계로
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (profile?.kyc_status === "pending") {
    return (
      <div className="phone-shell">
        <div className="phone-canvas">
          <AppHeader title="실명 인증" subtitle="2 / 4 단계" />
          <Progress step={2} />
          <div className="px-5 pt-6 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
            <div className="mt-3 text-[15px] font-extrabold text-foreground">검토 중입니다</div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              관리자가 검토 후 결과를 알림으로 전달드립니다.
            </p>
            <button
              onClick={() => navigate({ to: "/app" })}
              className="mt-6 w-full rounded-xl bg-surface py-3.5 text-[15px] font-bold text-foreground"
            >
              홈으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="phone-shell">
      <div className="phone-canvas">
        <AppHeader title="실명 인증" subtitle="2 / 4 단계" />
        <Progress step={2} />
        <div className="px-5 pt-3 pb-10">
          <h1 className="text-[22px] font-extrabold leading-tight text-foreground">
            실명 정보를
            <br />
            입력해 주세요
          </h1>
          <p className="mt-2 text-[12px] text-muted-foreground">
            안전한 거래를 위해 본인확인이 필요해요. 정보는 암호화 저장됩니다.
          </p>

          <div className="mt-6 space-y-2">
            <Input label="이름" placeholder="홍길동" value={fullName} onChange={setFullName} />
            <SelectInput
              label="신분증 종류"
              value={idType}
              onChange={setIdType}
              options={["주민등록증", "운전면허증", "여권"]}
            />
            <Input
              label="신분증 번호"
              placeholder="000000-0000000"
              value={idNumber}
              onChange={setIdNumber}
            />
            <Input
              label="휴대폰 번호"
              placeholder="010-0000-0000"
              value={phone}
              onChange={setPhone}
            />

            <FileInput label="신분증 앞면" file={idFront} onChange={setIdFront} />
            <FileInput label="신분증 뒷면" file={idBack} onChange={setIdBack} />
            <FileInput label="셀카 (신분증 들고)" file={selfie} onChange={setSelfie} />
          </div>

          <button
            onClick={submit}
            disabled={submitting}
            className="mt-8 block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground disabled:opacity-50"
          >
            {submitting ? "제출 중..." : "KYC 신청"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Input({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl bg-surface px-3 py-3 text-[14px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl bg-surface px-3 py-3 text-[14px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

function FileInput({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const id = `file-${label}`;
  const handle = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.files?.[0] ?? null);
  };
  return (
    <div>
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</div>
      <label
        htmlFor={id}
        className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-surface px-3 py-3 text-[13px] text-muted-foreground hover:bg-surface-strong"
      >
        {file ? (
          <>
            <Check className="h-4 w-4 text-success" />
            <span className="truncate font-semibold text-foreground">{file.name}</span>
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" />
            <span>이미지 선택</span>
          </>
        )}
      </label>
      <input id={id} type="file" accept="image/*" onChange={handle} className="hidden" />
    </div>
  );
}

export function Progress({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <div className="px-5">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-surface-strong"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
        {step > 1 && <Check className="h-3 w-3 text-success" />}
        <span>
          {step}단계: {["로그인", "실명 인증", "계좌 등록", "지갑 연결"][step - 1]}
        </span>
      </div>
    </div>
  );
}
