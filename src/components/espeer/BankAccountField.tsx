import { Building2, Check, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import type { Bank } from "@/data/mock";

export interface BankAccountEntry {
  id: string;
  bank: Bank;
  number: string;
  holder: string;
  verified?: boolean;
}

const BANKS: Bank[] = ["토스뱅크", "KB국민", "신한", "카카오뱅크", "우리", "농협"];

export function BankAccountField({
  accounts,
  value,
  onChange,
  onAdd,
  label = "법정화폐 입금 계좌",
}: {
  accounts: BankAccountEntry[];
  value?: string;
  onChange: (id: string) => void;
  onAdd?: (entry: BankAccountEntry) => void;
  label?: string;
}) {
  const [adding, setAdding] = useState(false);
  const [bank, setBank] = useState<Bank>("토스뱅크");
  const [number, setNumber] = useState("");
  const [holder, setHolder] = useState("");
  const selected = accounts.find((a) => a.id === value);

  const submitNew = () => {
    if (!number.trim() || !holder.trim()) return;
    const entry: BankAccountEntry = {
      id: `ba_${Date.now()}`,
      bank,
      number: number.trim(),
      holder: holder.trim(),
      verified: false,
    };
    onAdd?.(entry);
    onChange(entry.id);
    setAdding(false);
    setNumber("");
    setHolder("");
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-0.5 rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold text-primary"
          >
            <Plus className="h-3 w-3" /> 새 계좌
          </button>
        )}
      </div>

      {!adding && (
        <div className="mt-2 space-y-1">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onChange(a.id)}
              className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left ${
                selected?.id === a.id ? "bg-primary-soft" : "bg-surface"
              }`}
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-background text-primary">
                <Building2 className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <div className="text-[12px] font-bold text-foreground">
                  {a.bank} <span className="num-tnum text-muted-foreground">{a.number}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  예금주 {a.holder}
                  {a.verified ? " · 실명 검증" : " · 검증 대기"}
                </div>
              </div>
              {selected?.id === a.id && <Check className="h-4 w-4 text-primary" />}
            </button>
          ))}
        </div>
      )}

      {adding && (
        <div className="mt-2 space-y-1.5 rounded-xl bg-surface p-2.5">
          <div className="flex items-center gap-1.5">
            <select
              value={bank}
              onChange={(e) => setBank(e.target.value as Bank)}
              className="rounded-md border border-border bg-background px-2 py-1 text-[12px] font-bold"
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
            onChange={(e) => setNumber(e.target.value)}
            placeholder="계좌번호"
            className="num-tnum w-full rounded-md bg-background px-2 py-1.5 text-[12px] outline-none"
          />
          <input
            value={holder}
            onChange={(e) => setHolder(e.target.value)}
            placeholder="예금주명 (신분증과 동일)"
            className="w-full rounded-md bg-background px-2 py-1.5 text-[12px] outline-none"
          />
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setAdding(false)}
              className="flex-1 rounded-md bg-background py-1.5 text-[11px] font-bold text-muted-foreground"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submitNew}
              disabled={!number || !holder}
              className="flex-1 rounded-md bg-primary py-1.5 text-[11px] font-bold text-primary-foreground disabled:opacity-40"
            >
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
