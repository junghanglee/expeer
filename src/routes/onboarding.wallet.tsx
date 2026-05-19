import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppHeader } from "@/components/espeer/AppHeader";
import { Progress } from "./onboarding.kyc";
import { Wallet as WalletIcon, Trash2, Star } from "lucide-react";
import { useWallets } from "@/hooks/useWallets";
import { toast } from "sonner";
import { SimpleWalletLink } from "@/components/espeer/SimpleWalletLink";
import { useState } from "react";

export const Route = createFileRoute("/onboarding/wallet")({
  head: () => ({ meta: [{ title: "지갑 연결 — EXPEER" }] }),
  component: WalletStep,
});

function WalletStep() {
  const navigate = useNavigate();
  const { wallets, add, remove, setPrimary } = useWallets();
  const [busy, setBusy] = useState(false);

  const onAdd = async (input: { asset: string; network: string; address: string }) => {
    setBusy(true);
    try {
      const sameAsset = wallets.filter((w) => w.asset === input.asset);
      await add({
        ...input,
        label: null,
        is_primary: sameAsset.length === 0,
      });
      toast.success("지갑이 등록되었습니다");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "등록 실패");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="phone-shell">
      <div className="phone-canvas">
        <AppHeader title="지갑 연결" subtitle="4 / 4 단계" />
        <Progress step={4} />
        <div className="px-5 pt-3">
          <h1 className="text-[22px] font-extrabold leading-tight text-foreground">
            받을 지갑 주소를
            <br />
            등록해 주세요
          </h1>
          <p className="mt-2 text-[12px] text-muted-foreground">
            QR을 스캔하거나 주소를 직접 입력하세요. 자산별로 등록한 지갑이 거래 시 자동으로
            채워집니다.
          </p>

          {wallets.length > 0 && (
            <div className="mt-5 space-y-2">
              <div className="text-[11px] font-semibold text-muted-foreground">등록된 지갑</div>
              {wallets.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
                    <WalletIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-foreground">
                      {w.asset}{" "}
                      <span className="text-[11px] text-muted-foreground">· {w.network}</span>
                    </div>
                    <div className="truncate font-mono text-[11px] text-muted-foreground">
                      {w.address}
                    </div>
                  </div>
                  {w.is_primary ? (
                    <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[10px] font-bold text-primary">
                      기본
                    </span>
                  ) : (
                    <button
                      onClick={() => setPrimary(w.id, w.asset)}
                      className="text-muted-foreground"
                      aria-label="기본으로"
                    >
                      <Star className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => remove(w.id)}
                    className="text-destructive"
                    aria-label="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6">
            <SimpleWalletLink onAdd={onAdd} busy={busy} />
          </div>

          <button
            onClick={() => navigate({ to: "/app" })}
            disabled={wallets.length === 0}
            className="mb-8 mt-8 block w-full rounded-xl bg-primary py-3.5 text-center text-[15px] font-bold text-primary-foreground disabled:opacity-50"
          >
            EXPEER 시작하기
          </button>
        </div>
      </div>
    </div>
  );
}
