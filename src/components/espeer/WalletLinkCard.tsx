import { useMemo, useState } from "react";
import {
  Check,
  Loader2,
  Wallet as WalletIcon,
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import type { CryptoAsset } from "@/data/mock";
import { WalletAddressField, validateAddress, type SavedAddress } from "./WalletAddressField";

/**
 * 판매자 지갑 연결 단계형 카드
 * 1) 자산/네트워크 선택
 * 2) 주소 입력 + 형식 정합성
 * 3) 소유권 증명 (EIP-191 서명 목업)
 * 4) 잔액 스캔 (보유 확인)
 * 5) 저장(주소록 + 기본 지갑)
 */

export type WalletLinkStatus = "idle" | "ownership_ok" | "scanned" | "saved";

export interface LinkedWallet {
  id: string;
  asset: CryptoAsset;
  network: string;
  address: string;
  balance?: number;
  ownershipVerified: boolean;
  isPrimary?: boolean;
}

const ASSETS: CryptoAsset[] = ["USDT", "USDC", "DAI"];
const NETWORKS: Record<string, string[]> = {
  USDT: ["Polygon", "Ethereum", "BSC", "Tron"],
  USDC: ["Polygon", "Ethereum", "BSC", "Solana"],
  DAI: ["Ethereum", "Polygon"],
};

export function WalletLinkCard({
  saved,
  onSaveAddress,
  onLink,
}: {
  saved: SavedAddress[];
  onSaveAddress?: (entry: SavedAddress) => void;
  onLink: (w: LinkedWallet) => void;
}) {
  const [asset, setAsset] = useState<CryptoAsset>("USDT");
  const [network, setNetwork] = useState<string>(NETWORKS["USDT"][0]);
  const [addr, setAddr] = useState("");
  const [busy, setBusy] = useState<"sign" | "scan" | null>(null);
  const [status, setStatus] = useState<WalletLinkStatus>("idle");
  const [balance, setBalance] = useState<number | null>(null);

  const fmtCheck = useMemo(() => validateAddress(asset, addr), [asset, addr]);
  const networks = NETWORKS[asset] ?? ["Ethereum"];

  const reset = () => {
    setAddr("");
    setStatus("idle");
    setBalance(null);
  };

  const signOwnership = async () => {
    setBusy("sign");
    await new Promise((r) => setTimeout(r, 900));
    setStatus("ownership_ok");
    setBusy(null);
  };

  const scanBalance = async () => {
    setBusy("scan");
    await new Promise((r) => setTimeout(r, 800));
    // mock
    const b = asset === "USDT" ? 1240.5 : asset === "USDC" ? 320.0 : 80.25;
    setBalance(b);
    setStatus("scanned");
    setBusy(null);
  };

  const saveLink = () => {
    if (!fmtCheck.ok || status !== "scanned") return;
    onLink({
      id: `lw_${Date.now()}`,
      asset,
      network,
      address: addr.trim(),
      balance: balance ?? 0,
      ownershipVerified: true,
    });
    setStatus("saved");
    setTimeout(reset, 700);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <WalletIcon className="h-3.5 w-3.5 text-primary" />
        <span className="text-[12px] font-extrabold text-foreground">새 지갑 연결 (4단계)</span>
      </div>

      {/* 1. 자산 + 네트워크 */}
      <StepBox idx={1} label="자산 · 네트워크 선택" done={!!asset && !!network}>
        <div className="grid grid-cols-3 gap-1">
          {ASSETS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                setAsset(a);
                setNetwork(NETWORKS[a][0]);
                reset();
              }}
              className={`rounded-md py-1.5 text-[11px] font-extrabold ${
                asset === a
                  ? "bg-primary text-primary-foreground"
                  : "bg-background text-muted-foreground"
              }`}
            >
              {a}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <select
            value={network}
            onChange={(e) => {
              setNetwork(e.target.value);
              reset();
            }}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-bold"
          >
            {networks.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </div>
      </StepBox>

      {/* 2. 주소 입력 + 형식 검증 */}
      <StepBox idx={2} label="지갑 주소 입력 · 형식 검증" done={fmtCheck.ok}>
        <WalletAddressField
          asset={asset}
          value={addr}
          onChange={(v) => {
            setAddr(v);
            setStatus("idle");
            setBalance(null);
          }}
          saved={saved}
          onSave={onSaveAddress}
          label={`${asset} 받을/보유 주소 (${network})`}
        />
      </StepBox>

      {/* 3. 소유권 증명 */}
      <StepBox
        idx={3}
        label="소유권 증명 (서명)"
        done={status === "ownership_ok" || status === "scanned" || status === "saved"}
      >
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] text-muted-foreground">
            지갑 앱에서 “EXPEER 지갑 인증” 메시지에 서명합니다. (EIP-191)
          </p>
          {status === "idle" || status === undefined ? (
            <button
              type="button"
              disabled={!fmtCheck.ok || busy === "sign"}
              onClick={signOwnership}
              className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-40"
            >
              {busy === "sign" ? <Loader2 className="h-3 w-3 animate-spin" /> : "서명 요청"}
            </button>
          ) : (
            <span className="inline-flex items-center gap-0.5 rounded-md bg-success-soft px-1.5 py-0.5 text-[10px] font-bold text-success">
              <Check className="h-2.5 w-2.5" /> 서명 완료
            </span>
          )}
        </div>
      </StepBox>

      {/* 4. 잔액 스캔 */}
      <StepBox idx={4} label="네트워크 잔액 스캔" done={status === "scanned" || status === "saved"}>
        <div className="flex items-center justify-between gap-2">
          {balance != null ? (
            <span className="text-[11px] font-bold text-foreground">
              잔액{" "}
              <b className="num-tnum">
                {balance.toLocaleString("ko-KR", { maximumFractionDigits: 2 })}
              </b>{" "}
              {asset}
              <span className="ml-1 text-[10px] text-muted-foreground">({network})</span>
            </span>
          ) : (
            <span className="text-[10px] text-muted-foreground">
              소유권 확인 후 잔액을 조회합니다.
            </span>
          )}
          {status === "ownership_ok" && (
            <button
              type="button"
              disabled={busy === "scan"}
              onClick={scanBalance}
              className="shrink-0 rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground disabled:opacity-40"
            >
              {busy === "scan" ? <Loader2 className="h-3 w-3 animate-spin" /> : "잔액 조회"}
            </button>
          )}
        </div>
      </StepBox>

      {!fmtCheck.ok && addr && (
        <div className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-warning">
          <AlertTriangle className="h-3 w-3" /> {fmtCheck.reason}
        </div>
      )}

      <button
        type="button"
        onClick={saveLink}
        disabled={status !== "scanned"}
        className="mt-3 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-foreground py-2.5 text-[12px] font-extrabold text-background disabled:opacity-40"
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {status === "saved" ? "저장됨" : "이 지갑 연결 저장"}
      </button>
      <p className="mt-1 text-center text-[10px] text-muted-foreground">
        EXPEER는 키를 보관하지 않습니다. 서명·잔액 조회만 수행합니다.
      </p>
    </div>
  );
}

function StepBox({
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
