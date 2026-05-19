import { useEffect, useMemo, useState } from "react";
import { Check, AlertTriangle, QrCode, ClipboardPaste, Bookmark, ChevronDown } from "lucide-react";
import type { CryptoAsset } from "@/data/mock";

/**
 * 체인별 주소 형식 검증.
 * - EVM 계열(ETH/USDT/USDC/DAI/MATIC/BNB): 0x + 40 hex
 * - BTC: legacy(1/3) 26-35 base58 또는 bech32 (bc1...)
 * - SOL: base58 32-44
 * - XRP: r... 25-35
 */
const EVM_ASSETS: CryptoAsset[] = ["USDT", "USDC", "DAI", "ETH", "MATIC", "BNB"];

export function detectChainLabel(asset: CryptoAsset): string {
  if (asset === "BTC") return "Bitcoin";
  if (asset === "SOL") return "Solana";
  if (asset === "XRP") return "XRP Ledger";
  if (EVM_ASSETS.includes(asset)) return "EVM (ETH/Polygon/BSC)";
  return "—";
}

export function validateAddress(
  asset: CryptoAsset,
  addr: string,
): { ok: boolean; reason?: string } {
  const a = addr.trim();
  if (!a) return { ok: false, reason: "주소를 입력하세요" };
  if (asset === "BTC") {
    if (/^(bc1)[0-9a-z]{20,80}$/i.test(a)) return { ok: true };
    if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(a)) return { ok: true };
    return { ok: false, reason: "BTC 주소 형식이 아닙니다" };
  }
  if (asset === "SOL") {
    if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(a)) return { ok: true };
    return { ok: false, reason: "SOL 주소 형식이 아닙니다" };
  }
  if (asset === "XRP") {
    if (/^r[0-9a-zA-Z]{24,34}$/.test(a)) return { ok: true };
    return { ok: false, reason: "XRP 주소 형식이 아닙니다" };
  }
  // EVM
  if (/^0x[a-fA-F0-9]{40}$/.test(a)) return { ok: true };
  return { ok: false, reason: "EVM 주소(0x…40자) 형식이 아닙니다" };
}

export interface SavedAddress {
  id: string;
  asset: CryptoAsset;
  label: string;
  address: string;
}

export function WalletAddressField({
  asset,
  value,
  onChange,
  saved = [],
  onSave,
  label,
}: {
  asset: CryptoAsset;
  value: string;
  onChange: (v: string) => void;
  saved?: SavedAddress[];
  onSave?: (entry: SavedAddress) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [askLabel, setAskLabel] = useState(false);
  const [labelInput, setLabelInput] = useState("");
  const result = useMemo(() => validateAddress(asset, value), [asset, value]);
  const matchingSaved = useMemo(() => saved.filter((s) => s.asset === asset), [saved, asset]);

  // 자산이 바뀌면 검증 즉시 갱신 — 별도 effect 없음

  const paste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) onChange(t.trim());
    } catch {
      // ignore
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-muted-foreground">
          {label ?? `${asset} 받을 지갑 주소`}
        </div>
        <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
          {detectChainLabel(asset)}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            asset === "BTC"
              ? "bc1… / 1… / 3…"
              : asset === "SOL"
                ? "예: 9wK…"
                : asset === "XRP"
                  ? "r…"
                  : "0x…"
          }
          className="num-tnum flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <button
          type="button"
          onClick={paste}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-surface text-muted-foreground"
          aria-label="붙여넣기"
        >
          <ClipboardPaste className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => alert("QR 스캔 (목업)")}
          className="flex h-7 w-7 items-center justify-center rounded-md bg-surface text-muted-foreground"
          aria-label="QR 스캔"
        >
          <QrCode className="h-3.5 w-3.5" />
        </button>
        {matchingSaved.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex h-7 items-center gap-0.5 rounded-md bg-primary-soft px-1.5 text-[10px] font-bold text-primary"
          >
            주소록 <ChevronDown className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && matchingSaved.length > 0 && (
        <div className="mt-2 space-y-1 rounded-xl bg-surface p-2">
          {matchingSaved.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                onChange(s.address);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg bg-background px-2 py-1.5 text-left"
            >
              <div>
                <div className="text-[11px] font-bold text-foreground">{s.label}</div>
                <div className="num-tnum text-[10px] text-muted-foreground">
                  {s.address.slice(0, 8)}…{s.address.slice(-6)}
                </div>
              </div>
              <Bookmark className="h-3 w-3 text-primary" />
            </button>
          ))}
        </div>
      )}

      {value && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {result.ok ? (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success">
              <Check className="h-3 w-3" /> 형식 정상
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-warning">
              <AlertTriangle className="h-3 w-3" /> {result.reason}
            </span>
          )}
          {result.ok &&
            onSave &&
            !matchingSaved.some((s) => s.address === value.trim()) &&
            (askLabel ? (
              <div className="flex items-center gap-1">
                <input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  placeholder="주소록 라벨"
                  className="w-24 rounded-md bg-surface px-1.5 py-0.5 text-[10px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!labelInput.trim()) return;
                    onSave({
                      id: `addr_${Date.now()}`,
                      asset,
                      label: labelInput.trim(),
                      address: value.trim(),
                    });
                    setAskLabel(false);
                    setLabelInput("");
                  }}
                  className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground"
                >
                  저장
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAskLabel(true)}
                className="text-[10px] font-bold text-primary"
              >
                + 주소록에 저장
              </button>
            ))}
        </div>
      )}

      <div className="mt-2 flex items-start gap-1 text-[10px] text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-2.5 w-2.5" />
        <span>
          EXPEER는 지갑을 생성·보관하지 않아요. 입력 주소가 잘못되면 자산이 손실될 수 있으니 반드시
          본인 지갑임을 확인하세요.
        </span>
      </div>
    </div>
  );
}

// 디스플레이용 read-only 도우미
export function AddressBadge({ asset, address }: { asset: CryptoAsset; address: string }) {
  const r = validateAddress(asset, address);
  return (
    <span className="num-tnum inline-flex items-center gap-1 rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold text-foreground">
      {address.slice(0, 6)}…{address.slice(-4)}
      {r.ok && <Check className="h-2.5 w-2.5 text-success" />}
    </span>
  );
}

// 사용하지 않으면 빌드 경고가 날 수 있어 명시적 export 보장
useEffect; // tree-shake guard
