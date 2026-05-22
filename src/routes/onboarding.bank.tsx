import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Progress } from "./onboarding.kyc";
import { Building2, Trash2, Star, Loader2, Pencil } from "lucide-react";
import { useState } from "react";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { toast } from "sonner";

export const Route = createFileRoute("/onboarding/bank")({
  head: () => ({ meta: [{ title: "계좌 등록 — EXPEER" }] }),
  component: Bank,
});

const BANKS = ["토스뱅크", "KB국민", "신한", "카카오뱅크", "우리", "농협", "하나", "IBK기업"];

function Bank() {
  const navigate = useNavigate();
  const { accounts, loading, add, update, remove, setPrimary } = useBankAccounts();
  const [bank, setBank] = useState(BANKS[0]);
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const onAdd = async () => {
    if (!number.trim() || !holder.trim()) {
      toast.error("계좌번호와 예금주를 입력해 주세요");
      return;
    }
    setSubmitting(true);
    try {
      if (editingId) {
        await update(editingId, {
          bank_name: bank,
          account_number: number.trim(),
          account_holder: holder.trim(),
        });
        setEditingId(null);
        toast.success("계좌 정보가 수정되었습니다");
      } else {
        await add({
          bank_name: bank,
          account_number: number.trim(),
          account_holder: holder.trim(),
          is_primary: accounts.length === 0,
        });
        toast.success("계좌가 등록되었습니다");
      }
      setNumber("");
      setHolder("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "등록 실패";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (account: (typeof accounts)[number]) => {
    setEditingId(account.id);
    setBank(account.bank_name);
    setNumber(account.account_number);
    setHolder(account.account_holder);
  };

  return (
    <div className="phone-shell">
      <div className="phone-canvas">
        <AppHeader title="송금 계좌 등록" subtitle="3 / 4 단계" />
        <Progress step={3} />
        <div className="px-5 pt-3">
          <h1 className="text-[22px] font-extrabold leading-tight text-foreground">
            본인 명의 계좌를
            <br />
            등록해 주세요
          </h1>
          <p className="mt-2 text-[12px] text-muted-foreground">
            제3자 송금은 자동 분쟁으로 처리되니, 반드시 본인 명의 계좌만 등록해 주세요.
          </p>

          {accounts.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground">등록된 계좌</div>
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-foreground">
                      {a.bank_name}{" "}
                      <span className="num-tnum text-muted-foreground">{a.account_number}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      예금주 {a.account_holder}
                    </div>
                  </div>
                  {a.is_primary ? (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                      기본
                    </span>
                  ) : (
                    <button onClick={() => setPrimary(a.id)} className="text-muted-foreground">
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button onClick={() => startEdit(a)} className="text-muted-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => remove(a.id)} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">은행 선택</div>
            <div className="grid grid-cols-3 gap-2">
              {BANKS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBank(b)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-[12px] font-semibold ${
                    bank === b
                      ? "border-primary bg-primary-soft text-primary"
                      : "border-border bg-card text-foreground"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  {b}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <Field
                label="계좌번호"
                placeholder="1000-1234-5678"
                value={number}
                onChange={setNumber}
              />
              <Field
                label="예금주명 (신분증과 동일)"
                placeholder="홍길동"
                value={holder}
                onChange={setHolder}
              />
            </div>

            <button
              onClick={onAdd}
              disabled={submitting || loading}
              className="mt-4 w-full rounded-xl bg-surface-strong py-3 text-[14px] font-bold text-foreground disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              ) : editingId ? (
                "계좌 수정 저장"
              ) : (
                "+ 계좌 추가"
              )}
            </button>
          </div>

          <button
            onClick={() => navigate({ to: "/onboarding/wallet" })}
            disabled={accounts.length === 0}
            className="mt-8 block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground disabled:opacity-50"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
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
