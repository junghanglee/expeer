import { useState } from "react";
import {
  Check,
  ShieldCheck,
  Camera,
  IdCard,
  Smartphone,
  Loader2,
  User,
  FileImage,
  HelpCircle,
} from "lucide-react";

export type IdentityStep = "id" | "selfie" | "sms" | "bookcopy" | "antiphish";
export type IdentityState = {
  idUploaded: boolean;
  idHolderName?: string;
  /** 사용자가 직접 입력한 통장 예금주명 (구매자 입력) */
  declaredHolderName?: string;
  selfieMatched: boolean;
  smsVerified: boolean;
  /** 통장 사본/스크린샷 업로드 */
  bankbookUploaded?: boolean;
  /** 안티 피싱 질문 통과 (자금 출처/송금 목적) */
  antiPhishingPassed?: boolean;
};

export const EMPTY_IDENTITY: IdentityState = {
  idUploaded: false,
  selfieMatched: false,
  smsVerified: false,
  bankbookUploaded: false,
  antiPhishingPassed: false,
};

export function identityComplete(s: IdentityState) {
  return s.idUploaded && s.selfieMatched && s.smsVerified;
}

/** 매수자 강화 인증 — 통장 사본 + 안티피싱까지 */
export function identityFullyComplete(s: IdentityState) {
  return identityComplete(s) && !!s.bankbookUploaded && !!s.antiPhishingPassed;
}

export function IdentityVerifyCard({
  state,
  onChange,
  expectedHolder,
  compact = false,
  /** 매수자 강화 모드: 통장주이름 입력 + 통장사본 + 안티피싱 질문 노출 */
  buyerMode = false,
}: {
  state: IdentityState;
  onChange: (s: IdentityState) => void;
  expectedHolder?: string;
  compact?: boolean;
  buyerMode?: boolean;
}) {
  const [busy, setBusy] = useState<IdentityStep | null>(null);
  const [phishAns, setPhishAns] = useState<string>("");

  const runId = async () => {
    setBusy("id");
    await new Promise((r) => setTimeout(r, 700));
    onChange({ ...state, idUploaded: true, idHolderName: expectedHolder ?? "김토스" });
    setBusy(null);
  };
  const runSelfie = async () => {
    setBusy("selfie");
    await new Promise((r) => setTimeout(r, 900));
    onChange({ ...state, selfieMatched: true });
    setBusy(null);
  };
  const runSms = async () => {
    setBusy("sms");
    await new Promise((r) => setTimeout(r, 600));
    onChange({ ...state, smsVerified: true });
    setBusy(null);
  };
  const runBookcopy = async () => {
    setBusy("bookcopy");
    await new Promise((r) => setTimeout(r, 700));
    onChange({ ...state, bankbookUploaded: true });
    setBusy(null);
  };
  const runAntiPhish = async () => {
    if (phishAns.trim().length < 2) return;
    setBusy("antiphish");
    await new Promise((r) => setTimeout(r, 500));
    onChange({ ...state, antiPhishingPassed: true });
    setBusy(null);
  };

  const declaredVsId =
    state.idHolderName && state.declaredHolderName
      ? state.idHolderName.trim() === state.declaredHolderName.trim()
      : undefined;
  const holderMatch = state.idUploaded && expectedHolder && state.idHolderName === expectedHolder;

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      {!compact && (
        <div className="mb-2 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          <span className="text-[12px] font-extrabold text-foreground">
            신분 확인 ({buyerMode ? "5단계 · 매수자 강화" : "3단계"})
          </span>
        </div>
      )}

      <div className="space-y-2">
        {/* 매수자 모드: 통장 예금주명 자기 입력 */}
        {buyerMode && (
          <div className="rounded-xl bg-surface p-2.5">
            <div className="mb-1.5 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-bold text-foreground">
                통장 예금주명 (본인 입력)
              </span>
            </div>
            <input
              value={state.declaredHolderName ?? ""}
              onChange={(e) => onChange({ ...state, declaredHolderName: e.target.value })}
              placeholder="송금할 통장의 예금주명을 입력"
              className="w-full rounded-md bg-background px-2 py-1.5 text-[12px] outline-none"
            />
            {state.idUploaded && state.declaredHolderName && (
              <div
                className={`mt-1 inline-flex items-center gap-1 text-[10px] font-bold ${
                  declaredVsId ? "text-success" : "text-warning"
                }`}
              >
                {declaredVsId ? <Check className="h-3 w-3" /> : <HelpCircle className="h-3 w-3" />}
                {declaredVsId
                  ? `신분증 명의(${state.idHolderName})와 일치`
                  : `신분증 명의(${state.idHolderName ?? "-"})와 다름 — 거래 거절 가능`}
              </div>
            )}
          </div>
        )}

        <Step
          icon={<IdCard className="h-4 w-4" />}
          label="신분증 업로드 + OCR"
          done={state.idUploaded}
          busy={busy === "id"}
          onClick={runId}
          extra={
            state.idUploaded && (
              <div className="text-[10px] text-muted-foreground">
                예금주명 매칭:{" "}
                {holderMatch ? (
                  <b className="text-success">일치</b>
                ) : (
                  <b className="text-warning">
                    {expectedHolder ? "확인 필요" : "기준 통장 미선택"}
                  </b>
                )}
              </div>
            )
          }
        />
        <Step
          icon={<Camera className="h-4 w-4" />}
          label="셀피 라이브니스"
          done={state.selfieMatched}
          busy={busy === "selfie"}
          disabled={!state.idUploaded}
          onClick={runSelfie}
          extra={
            state.selfieMatched && (
              <div className="text-[10px] text-success font-bold">동일 인물 확인</div>
            )
          }
        />
        <Step
          icon={<Smartphone className="h-4 w-4" />}
          label="휴대폰 본인인증 (SMS)"
          done={state.smsVerified}
          busy={busy === "sms"}
          onClick={runSms}
        />

        {buyerMode && (
          <>
            <Step
              icon={<FileImage className="h-4 w-4" />}
              label="통장 사본 / 입출금 화면 업로드"
              done={!!state.bankbookUploaded}
              busy={busy === "bookcopy"}
              disabled={!state.idUploaded}
              onClick={runBookcopy}
              extra={
                state.bankbookUploaded && (
                  <div className="text-[10px] font-bold text-success">예금주명 기재 확인</div>
                )
              }
            />
            <div className="rounded-xl bg-surface p-2.5">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    state.antiPhishingPassed
                      ? "bg-success text-success-foreground"
                      : "bg-background text-primary"
                  }`}
                >
                  {state.antiPhishingPassed ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <HelpCircle className="h-4 w-4" />
                  )}
                </div>
                <div className="flex-1 text-[12px] font-bold text-foreground">안티-피싱 질문</div>
                {state.antiPhishingPassed && (
                  <span className="text-[10px] font-bold text-success">완료</span>
                )}
              </div>
              {!state.antiPhishingPassed && (
                <div className="mt-2 space-y-1.5 pl-9">
                  <p className="text-[10px] text-muted-foreground">
                    Q. 이 코인의 사용 목적은? (예: 개인 투자, 해외 송금)
                  </p>
                  <div className="flex items-center gap-1">
                    <input
                      value={phishAns}
                      onChange={(e) => setPhishAns(e.target.value)}
                      placeholder="간단히 답변"
                      className="flex-1 rounded-md bg-background px-2 py-1.5 text-[12px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={runAntiPhish}
                      disabled={busy === "antiphish" || phishAns.trim().length < 2}
                      className="rounded-md bg-primary px-2 py-1.5 text-[10px] font-bold text-primary-foreground disabled:opacity-40"
                    >
                      {busy === "antiphish" ? <Loader2 className="h-3 w-3 animate-spin" /> : "제출"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {(buyerMode ? identityFullyComplete(state) : identityComplete(state)) && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">
          <Check className="h-2.5 w-2.5" /> 신분 확인 완료
        </div>
      )}
    </div>
  );
}

function Step({
  icon,
  label,
  done,
  busy,
  disabled,
  onClick,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  done: boolean;
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface p-2.5">
      <div className="flex items-center gap-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${
            done ? "bg-success text-success-foreground" : "bg-background text-primary"
          }`}
        >
          {done ? <Check className="h-4 w-4" /> : icon}
        </div>
        <div className="flex-1 text-[12px] font-bold text-foreground">{label}</div>
        {!done && (
          <button
            type="button"
            onClick={onClick}
            disabled={disabled || busy}
            className="rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-40"
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "진행"}
          </button>
        )}
        {done && <span className="text-[10px] font-bold text-success">완료</span>}
      </div>
      {extra && <div className="mt-1.5 pl-9">{extra}</div>}
    </div>
  );
}
