import { useState } from "react";
import { Lock, Unlock, RotateCcw, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";
import {
  approveAndLock,
  releaseEscrow,
  refundEscrow,
  ESCROW_ADDRESSES,
  type SupportedChain,
} from "@/lib/escrow";
import { TOKEN_CONTRACTS } from "@/utils/onchain.functions";
import {
  recordEscrowLock,
  recordEscrowRelease,
  recordEscrowRefund,
} from "@/utils/escrow.functions";
import type { Address } from "viem";

type Props = {
  orderId: string;
  chain: SupportedChain;
  asset: string; // "USDT" | "USDC"
  amount: number;
  buyerWallet: string;
  escrowStatus: "none" | "locked" | "released" | "refunded" | "disputed";
  lockTxHash?: string | null;
  releaseTxHash?: string | null;
  expiresAt?: string | null; // KRW 입금 마감
  onChange?: () => void;
};

const EXPLORER: Record<SupportedChain, string> = {
  base: "https://basescan.org/tx/",
  "base-sepolia": "https://sepolia.basescan.org/tx/",
  polygon: "https://polygonscan.com/tx/",
  ethereum: "https://etherscan.io/tx/",
};

export function EscrowPanel({
  orderId,
  chain,
  asset,
  amount,
  buyerWallet,
  escrowStatus,
  lockTxHash,
  releaseTxHash,
  onChange,
}: Props) {
  const [busy, setBusy] = useState<"lock" | "release" | "refund" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const escrowAddress = ESCROW_ADDRESSES[chain];
  const tokenInfo = TOKEN_CONTRACTS[chain === "base-sepolia" ? "base" : chain]?.[asset];
  const explorer = EXPLORER[chain];

  if (!escrowAddress) {
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning/10 p-3 text-[12px] text-warning-foreground">
        <div className="flex items-center gap-1.5 font-bold">
          <AlertTriangle className="h-3.5 w-3.5" />
          에스크로 컨트랙트가 아직 배포되지 않았습니다
        </div>
        <p className="mt-1 text-muted-foreground">
          관리자가 {chain} 네트워크에 EscrowVault를 배포한 후 사용 가능합니다.
        </p>
      </div>
    );
  }

  if (!tokenInfo) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-3 text-[12px] text-muted-foreground">
        {chain}에서 {asset} 에스크로를 지원하지 않습니다.
      </div>
    );
  }

  const handleLock = async () => {
    setBusy("lock");
    setError(null);
    try {
      const { lockTx } = await approveAndLock({
        chain,
        escrowAddress,
        tokenAddress: tokenInfo.address as Address,
        tokenDecimals: tokenInfo.decimals,
        orderId,
        buyer: buyerWallet as Address,
        amountHuman: amount,
        expiresInSec: 60 * 60, // 60분
      });
      const r = await recordEscrowLock({
        data: { orderId, chain, escrowAddress, lockTxHash: lockTx },
      });
      if (!r.ok) throw new Error(r.error);
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "락업 실패");
    } finally {
      setBusy(null);
    }
  };

  const handleRelease = async () => {
    setBusy("release");
    setError(null);
    try {
      const tx = await releaseEscrow(chain, escrowAddress, orderId);
      const r = await recordEscrowRelease({ data: { orderId, releaseTxHash: tx } });
      if (!r.ok) throw new Error(r.error);
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "릴리즈 실패");
    } finally {
      setBusy(null);
    }
  };

  const handleRefund = async () => {
    setBusy("refund");
    setError(null);
    try {
      const tx = await refundEscrow(chain, escrowAddress, orderId);
      const r = await recordEscrowRefund({ data: { orderId, refundTxHash: tx } });
      if (!r.ok) throw new Error(r.error);
      onChange?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "환불 실패");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2 rounded-2xl border border-primary-soft bg-primary-soft/40 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-foreground">
          <Lock className="h-3.5 w-3.5 text-primary" />
          온체인 에스크로
        </div>
        <StatusPill status={escrowStatus} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <Cell label="네트워크" value={chain} />
        <Cell label="자산" value={`${amount} ${asset}`} />
      </div>

      {lockTxHash && (
        <a
          href={`${explorer}${lockTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline"
        >
          락업 트랜잭션 보기 <ExternalLink className="h-3 w-3" />
        </a>
      )}
      {releaseTxHash && (
        <a
          href={`${explorer}${releaseTxHash}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-success hover:underline"
        >
          릴리즈 트랜잭션 보기 <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {error && (
        <div className="rounded-lg bg-destructive-soft px-2 py-1.5 text-[11px] font-semibold text-destructive">
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {escrowStatus === "none" && (
          <Btn onClick={handleLock} busy={busy === "lock"} icon={<Lock className="h-3.5 w-3.5" />}>
            {amount} {asset} 락업
          </Btn>
        )}
        {escrowStatus === "locked" && (
          <>
            <Btn
              onClick={handleRelease}
              busy={busy === "release"}
              variant="success"
              icon={<Unlock className="h-3.5 w-3.5" />}
            >
              구매자에게 지급
            </Btn>
            <Btn
              onClick={handleRefund}
              busy={busy === "refund"}
              variant="ghost"
              icon={<RotateCcw className="h-3.5 w-3.5" />}
            >
              환불 (만료 후)
            </Btn>
          </>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: Props["escrowStatus"] }) {
  const map = {
    none: { label: "미락업", cls: "bg-muted text-muted-foreground" },
    locked: { label: "락업됨", cls: "bg-primary-soft text-primary" },
    released: { label: "지급완료", cls: "bg-success-soft text-success" },
    refunded: { label: "환불됨", cls: "bg-muted text-muted-foreground" },
    disputed: { label: "분쟁중", cls: "bg-destructive-soft text-destructive" },
  } as const;
  const v = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v.cls}`}>{v.label}</span>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-background/60 px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="num-display text-[12px] font-bold text-foreground">{value}</div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  busy,
  variant = "primary",
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
  variant?: "primary" | "success" | "ghost";
  icon?: React.ReactNode;
}) {
  const cls = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    success: "bg-success text-success-foreground hover:bg-success/90",
    ghost: "bg-surface text-foreground border border-border hover:bg-surface-strong",
  }[variant];
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-[11px] font-bold disabled:opacity-50 ${cls}`}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}
