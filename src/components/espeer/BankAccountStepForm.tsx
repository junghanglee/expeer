import { useState } from "react";
import {
  Building2,
  Check,
  Loader2,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  FileImage,
} from "lucide-react";
import type { Bank } from "@/data/format";
import type { BankAccountEntry } from "./BankAccountField";

/**
 * 판매자 입금 계좌 단계형 등록 폼 (3단계)
 * 1) 은행 · 계좌번호 · 통장 유형
 * 2) 예금주명 입력 (신분증 명의와 매칭)
 * 3) 통장 사본 업로드 (예금주 표기 확인) → 저장
 */

const BANKS: Bank[] = ["토스뱅크", "KB국민", "신한", "카카오뱅크", "우리", "농협"];

export type AccountType = "personal" | "business";

export interface BankStepResult extends BankAccountEntry {
  type: AccountType;
}

export function BankAccountStepForm({
  expectedHolder,
  onSubmit,
}: {
  /** 신분증/사업자 등록상의 정확한 예금주명 — 매칭에 사용 */
  expectedHolder?: string;
  onSubmit: (entry: BankStepResult) => void;
}) {
  const [bank, setBank] = useState<Bank>("토스뱅크");
  const [number, setNumber] = useState("");
  const [type, setType] = useState<AccountType>("personal");
  const [holder, setHolder] = useState(expectedHolder ?? "");
  const [bookUploaded, setBookUploaded] = useState(false);
  const [busy, setBusy] = useState<null | "upload" | "submit">(null);
  const [done, setDone] = useState(false);

  const numberOk = number.replace(/\D/g, "").length >= 10;
  const holderOk = holder.trim().length >= 2;
  const matchOk = expectedHolder ? holder.trim() === expectedHolder.trim() : true;
  const allOk = numberOk && holderOk && matchOk && bookUploaded;

  const uploadBook = async () => {
    setBusy("upload");
    await new Promise((r) => setTimeout(r, 700));
    setBookUploaded(true);
    setBusy(null);
  };

  const submit = async () => {
    if (!allOk) return;
    setBusy("submit");
    await new Promise((r) => setTimeout(r, 500));
    onSubmit({
      id: `ba_${Date.now()}`,
      bank,
      number: number.trim(),
      holder: holder.trim(),
      verified: true,
      type,
    });
    setDone(true);
    setBusy(null);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        <span className="text-[12px] font-extrabold text-foreground">새 통장 등록 (3단계)</span>
      </div>

      {/* 1. 은행 / 계좌 / 유형 */}
      <Step idx={1} label="은행 · 계좌번호 · 통장 유형" done={numberOk}>
        <div className="space-y-1.5">
          <div className="flex items-center gap-1">
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value as Bank)}
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[12px] font-bold"
            >
              {BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </div>
          <input
            value={number}
            onChange={(e) => {
              setNumber(e.target.value);
              setBookUploaded(false);
            }}
            placeholder="계좌번호 (- 없이)"
            className="num-tnum w-full rounded-md bg-background px-2 py-1.5 text-[12px] outline-none"
          />
          <div className="grid grid-cols-2 gap-1">
            {(["personal", "business"] as AccountType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`rounded-md py-1.5 text-[11px] font-extrabold ${
                  type === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground"
                }`}
              >
                {t === "personal" ? "개인" : "사업자"}
              </button>
            ))}
          </div>
        </div>
      </Step>

      {/* 2. 예금주명 */}
      <Step idx={2} label="예금주명 (신분증 명의와 동일)" done={holderOk && matchOk}>
        <input
          value={holder}
          onChange={(e) => {
            setHolder(e.target.value);
            setBookUploaded(false);
          }}
          placeholder={expectedHolder ? `예: ${expectedHolder}` : "예금주명"}
          className="w-full rounded-md bg-background px-2 py-1.5 text-[12px] outline-none"
        />
        {expectedHolder && holder && !matchOk && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-warning">
            <AlertTriangle className="h-3 w-3" /> 신분증 명의 “{expectedHolder}” 와 다릅니다
          </div>
        )}
        {matchOk && holder && (
          <div className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-success">
            <Check className="h-3 w-3" /> 명의 일치
          </div>
        )}
      </Step>

      {/* 3. 통장 사본 업로드 */}
      <Step idx={3} label="통장 사본 업로드 (예금주명 표기 확인)" done={bookUploaded}>
        {bookUploaded ? (
          <div className="inline-flex items-center gap-1 text-[11px] font-bold text-success">
            <Check className="h-3 w-3" /> 사본 검토 완료
          </div>
        ) : (
          <button
            type="button"
            disabled={!numberOk || !holderOk || !matchOk || busy === "upload"}
            onClick={uploadBook}
            className="inline-flex w-full items-center justify-center gap-1 rounded-md bg-primary py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-40"
          >
            {busy === "upload" ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <FileImage className="h-3.5 w-3.5" /> 통장 사본·앱 화면 업로드
              </>
            )}
          </button>
        )}
      </Step>

      <button
        type="button"
        onClick={submit}
        disabled={!allOk || busy === "submit" || done}
        className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-foreground py-2.5 text-[12px] font-extrabold text-background disabled:opacity-40"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {done ? "등록 완료" : busy === "submit" ? "등록 중…" : "통장 등록"}
      </button>

      <div className="mt-2 grid grid-cols-3 gap-1 text-center text-[9px]">
        <Badge ok={numberOk} label="계좌" />
        <Badge ok={holderOk && matchOk} label="명의" />
        <Badge ok={bookUploaded} label="사본" />
      </div>
    </div>
  );
}

function Step({
  idx,
  label,
  done,
  children,
}: {
  idx: number;
  label: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-2 rounded-xl bg-surface p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-extrabold ${
            done ? "bg-success text-success-foreground" : "bg-background text-muted-foreground"
          }`}
        >
          {done ? "✓" : idx}
        </span>
        <span className="text-[11px] font-bold text-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      className={`rounded-md px-1 py-1 font-extrabold ${
        ok ? "bg-success-soft text-success" : "bg-surface text-muted-foreground"
      }`}
    >
      {ok ? "✓ " : "· "}
      {label}
    </div>
  );
}
