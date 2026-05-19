import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AdminShell } from "./expeeradmin.dashboard";
import { useFeeSettings, saveFeeSettings, DEFAULT_FEES } from "@/hooks/useAppSettings";
import { Loader2, Percent, Save, RotateCcw, Link2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminSaveEscrowContracts } from "@/utils/admin.functions";

export const Route = createFileRoute("/expeeradmin/settings")({
  head: () => ({ meta: [{ title: "운영자 설정 — EXPEER" }] }),
  component: AdminSettings,
});

function AdminSettings() {
  const { fees, loading, refresh } = useFeeSettings();
  const [buyer, setBuyer] = useState<string>("1");
  const [seller, setSeller] = useState<string>("1");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setBuyer(String(fees.buyer_pct));
      setSeller(String(fees.seller_pct));
    }
  }, [loading, fees.buyer_pct, fees.seller_pct]);

  const onSave = async () => {
    const b = Number(buyer);
    const s = Number(seller);
    if (!Number.isFinite(b) || !Number.isFinite(s) || b < 0 || s < 0 || b > 100 || s > 100) {
      toast.error("0~100 사이의 숫자를 입력해주세요");
      return;
    }
    setSaving(true);
    try {
      await saveFeeSettings({ buyer_pct: b, seller_pct: s });
      toast.success("수수료 설정이 저장되었습니다");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => {
    setBuyer(String(DEFAULT_FEES.buyer_pct));
    setSeller(String(DEFAULT_FEES.seller_pct));
  };

  return (
    <AdminShell title="플랫폼 설정">
      <div className="max-w-2xl">
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="mb-1 text-[15px] font-extrabold text-foreground">거래 수수료</div>
          <p className="mb-4 text-[12px] text-muted-foreground">
            매수자/매도자 각각에게 부과되는 수수료 비율을 설정합니다. 변경 후 신규 주문부터
            적용되며, 기존 주문은 생성 시점의 수수료가 그대로 유지됩니다.
          </p>

          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-4">
              <FeeInput label="매수자 수수료" value={buyer} onChange={setBuyer} />
              <FeeInput label="매도자 수수료" value={seller} onChange={setSeller} />

              <div className="rounded-xl bg-surface p-3 text-[12px] text-muted-foreground">
                예시: 100,000원 거래 시 — 매수자 부담{" "}
                <b className="text-foreground">
                  {Math.round((100000 * (Number(buyer) || 0)) / 100).toLocaleString("ko-KR")}원
                </b>
                , 매도자 부담{" "}
                <b className="text-foreground">
                  {Math.round((100000 * (Number(seller) || 0)) / 100).toLocaleString("ko-KR")}원
                </b>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={onSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "저장 중…" : "저장"}
                </button>
                <button
                  onClick={onReset}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  기본값(1%)으로
                </button>
              </div>
            </div>
          )}
        </div>

        <EscrowContractsPanel />
      </div>
    </AdminShell>
  );
}

type ChainKey = "base" | "base-sepolia" | "polygon";
const CHAIN_LABELS: Record<ChainKey, string> = {
  base: "Base Mainnet",
  "base-sepolia": "Base Sepolia (테스트넷)",
  polygon: "Polygon",
};

function EscrowContractsPanel() {
  const [values, setValues] = useState<Record<ChainKey, string>>({
    base: "",
    "base-sepolia": "",
    polygon: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "escrow_contracts")
        .maybeSingle();
      const v = (data?.value as Record<string, string | null> | null) ?? {};
      setValues({
        base: v.base ?? "",
        "base-sepolia": v["base-sepolia"] ?? "",
        polygon: v.polygon ?? "",
      });
      setLoading(false);
    })();
  }, []);

  const onSave = async () => {
    const re = /^0x[a-fA-F0-9]{40}$/;
    const payload: Record<string, string | null> = {};
    for (const k of Object.keys(values) as ChainKey[]) {
      const v = values[k].trim();
      if (!v) {
        payload[k] = null;
        continue;
      }
      if (!re.test(v)) {
        toast.error(`${CHAIN_LABELS[k]} 주소 형식이 올바르지 않습니다`);
        return;
      }
      payload[k] = v;
    }
    setSaving(true);
    try {
      const res = await adminSaveEscrowContracts({ data: payload });
      if (!res.ok) throw new Error(res.error ?? "저장 실패");
      toast.success("에스크로 컨트랙트 주소가 저장되었습니다");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-border bg-background p-5">
      <div className="mb-1 flex items-center gap-2 text-[15px] font-extrabold text-foreground">
        <Link2 className="h-4 w-4 text-primary" />
        에스크로 컨트랙트 주소
      </div>
      <p className="mb-4 text-[12px] text-muted-foreground">
        체인별로 배포된 <code className="rounded bg-surface px-1">ExpeerEscrowVaultV2</code> 주소를
        등록합니다. 주소 등록 즉시 사용자 지갑 hook과 온체인 인덱서가 이 주소를 신뢰의 근원(source
        of truth)으로 사용합니다. 잘못된 주소를 저장하면 모든 거래가 중단되니 배포 트랜잭션 해시로
        반드시 검증 후 입력하세요.
      </p>

      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-3">
          {(Object.keys(CHAIN_LABELS) as ChainKey[]).map((k) => (
            <div key={k}>
              <label className="mb-1 block text-[12px] font-bold text-foreground">
                {CHAIN_LABELS[k]}
              </label>
              <input
                value={values[k]}
                onChange={(e) => setValues((s) => ({ ...s, [k]: e.target.value }))}
                placeholder="0x..."
                spellCheck={false}
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 font-mono text-[13px] text-foreground outline-none focus:border-primary"
              />
            </div>
          ))}

          <div className="pt-1">
            <button
              onClick={onSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[13px] font-bold text-primary-foreground disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? "저장 중…" : "주소 저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FeeInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[12px] font-bold text-foreground">{label}</label>
      <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 focus-within:border-primary">
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="num-display w-full bg-transparent text-[18px] font-bold text-foreground outline-none"
        />
        <Percent className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}
