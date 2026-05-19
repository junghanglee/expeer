import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { Section } from "@/components/espeer/Section";
import { NumberStepper } from "@/components/espeer/NumberStepper";
import { ArrowLeft, Plus, ShieldCheck, Lock, Loader2 } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useWallets } from "@/hooks/useWallets";
import { createOffer } from "@/hooks/useOffers";
import { toast } from "sonner";

export const Route = createFileRoute("/app/selling/new")({
  head: () => ({ meta: [{ title: "오퍼 등록 — EXPEER" }] }),
  component: NewOffer,
});

const ASSETS = ["USDT", "USDC", "DAI", "BTC", "ETH", "SOL", "BNB", "XRP", "MATIC"] as const;
const NETWORKS: Record<string, string[]> = {
  USDT: ["TRC20", "ERC20", "BEP20", "Base Sepolia"],
  USDC: ["Base Sepolia", "ERC20", "BEP20", "Polygon"],
  DAI: ["ERC20"],
  BTC: ["Bitcoin"],
  ETH: ["ERC20", "Arbitrum", "Optimism"],
  SOL: ["Solana"],
  BNB: ["BEP20"],
  XRP: ["XRP Ledger"],
  MATIC: ["Polygon", "ERC20"],
};
const PAYMENT_METHODS = ["bank_transfer", "toss", "kakao_pay"];

function NewOffer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { accounts } = useBankAccounts();
  const { wallets } = useWallets();

  const [side, setSide] = useState<"sell" | "buy">("sell");
  const [asset, setAsset] = useState<string>("USDC");
  const [network, setNetwork] = useState<string>("Base Sepolia");
  const [price, setPrice] = useState("1380");
  const [total, setTotal] = useState("1000");
  const [minOrder, setMinOrder] = useState("100000");
  const [maxOrder, setMaxOrder] = useState("10000000");
  const [methods, setMethods] = useState<string[]>(["bank_transfer"]);
  const [terms, setTerms] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 자산 변경 시 네트워크 재설정
  useEffect(() => {
    setNetwork(NETWORKS[asset][0]);
  }, [asset]);

  const assetWallets = useMemo(() => wallets.filter((w) => w.asset === asset), [wallets, asset]);

  const valid =
    Number(price) > 0 &&
    Number(total) > 0 &&
    Number(minOrder) > 0 &&
    Number(maxOrder) >= Number(minOrder) &&
    methods.length > 0 &&
    (side === "buy" ? accounts.length > 0 : assetWallets.length > 0);

  const submit = async () => {
    if (!user) return;
    if (!valid) {
      toast.error("입력값을 확인해 주세요");
      return;
    }
    setSubmitting(true);
    try {
      await createOffer(user.id, {
        side,
        asset,
        network,
        fiat: "KRW",
        price: Number(price),
        total_amount: Number(total),
        min_order: Number(minOrder),
        max_order: Number(maxOrder),
        payment_methods: methods,
        terms: terms.trim() || null,
        status: "active",
      });
      toast.success("오퍼가 등록되었습니다");
      navigate({ to: "/app/selling" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "등록 실패";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMethod = (m: string) =>
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  return (
    <PhoneShell hideTab>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/app/selling"
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-foreground">오퍼 등록</div>
            <div className="text-[10px] font-semibold text-muted-foreground">매칭 시 자동 락업</div>
          </div>
        </div>
      </header>

      <div className="mx-4 mt-3 flex items-start gap-2 rounded-xl border border-primary-soft bg-primary-soft/60 p-3">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="text-[11px] leading-relaxed text-foreground/80">
          오퍼 등록 시점에는 자산이 이동하지 않아요. 매수자가 매칭되면 <b>스마트 컨트랙트</b>가
          정확한 수량만 일시 락업합니다.
        </div>
      </div>

      <Section title="오퍼 종류">
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setSide("sell")}
            className={`rounded-xl py-2.5 text-[12px] font-extrabold transition-colors ${
              side === "sell"
                ? "bg-destructive text-destructive-foreground"
                : "bg-surface text-muted-foreground"
            }`}
          >
            판매 (코인 → 원화)
          </button>
          <button
            onClick={() => setSide("buy")}
            className={`rounded-xl py-2.5 text-[12px] font-extrabold transition-colors ${
              side === "buy"
                ? "bg-success text-success-foreground"
                : "bg-surface text-muted-foreground"
            }`}
          >
            구매 (원화 → 코인)
          </button>
        </div>
      </Section>

      <Section title="자산 / 네트워크">
        <div className="space-y-2">
          <div className="flex gap-1.5">
            {ASSETS.map((a) => (
              <button
                key={a}
                onClick={() => setAsset(a)}
                className={`flex-1 rounded-xl py-2 text-[12px] font-bold ${
                  asset === a
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted-foreground"
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {NETWORKS[asset].map((n) => (
              <button
                key={n}
                onClick={() => setNetwork(n)}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                  network === n
                    ? "bg-primary-soft text-primary"
                    : "bg-surface text-muted-foreground"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </Section>

      <Section title="가격 · 수량 · 한도">
        <div className="space-y-2.5">
          <label className="block">
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
              단가 (KRW / 1 {asset})
            </div>
            <NumberStepper
              value={price}
              onChange={setPrice}
              step={1}
              min={0}
              unit="KRW"
              ariaLabel="단가"
            />
          </label>
          <NumField label={`총 수량 (${asset})`} value={total} onChange={setTotal} />
          <div className="grid grid-cols-2 gap-2">
            <NumField label="최소 주문 (KRW)" value={minOrder} onChange={setMinOrder} />
            <NumField label="최대 주문 (KRW)" value={maxOrder} onChange={setMaxOrder} />
          </div>
        </div>
      </Section>

      <Section title="결제 수단">
        <div className="flex flex-wrap gap-1.5">
          {PAYMENT_METHODS.map((m) => (
            <button
              key={m}
              onClick={() => toggleMethod(m)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                methods.includes(m)
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-muted-foreground"
              }`}
            >
              {m === "bank_transfer" ? "계좌이체" : m === "toss" ? "토스" : "카카오페이"}
            </button>
          ))}
        </div>
      </Section>

      <Section title="거래 조건 / 안내 (선택)">
        <textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          rows={3}
          placeholder="예: 입금 후 채팅으로 알려주세요."
          className="w-full rounded-xl bg-surface px-3 py-2.5 text-[13px] focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </Section>

      {side === "sell" && assetWallets.length === 0 && (
        <div className="mx-4 mt-2 rounded-xl bg-warning-soft p-3 text-[11px] text-warning-foreground">
          {asset} 지갑이 등록되어 있지 않습니다.{" "}
          <Link to="/onboarding/wallet" className="font-bold underline">
            지갑 등록하기
          </Link>
        </div>
      )}
      {side === "buy" && accounts.length === 0 && (
        <div className="mx-4 mt-2 rounded-xl bg-warning-soft p-3 text-[11px] text-warning-foreground">
          입금받을 계좌가 등록되어 있지 않습니다.{" "}
          <Link to="/onboarding/bank" className="font-bold underline">
            계좌 등록하기
          </Link>
        </div>
      )}

      <div className="px-4 pt-2">
        <ul className="space-y-1 text-[11px] text-foreground/70">
          <li className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" />
            매칭 시점에 컨트랙트가 정확한 수량만 락업
          </li>
          <li className="flex items-start gap-1.5">
            <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-success" />
            EXPEER는 지갑·코인을 보관·생성하지 않습니다 (비수탁)
          </li>
        </ul>
      </div>

      <div className="px-4 pb-6 pt-5">
        <button
          onClick={submit}
          disabled={!valid || submitting}
          className="flex w-full items-center justify-center gap-1.5 rounded-2xl bg-primary py-3.5 text-[15px] font-extrabold text-primary-foreground disabled:opacity-50"
        >
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          오퍼 등록하기
        </button>
      </div>
    </PhoneShell>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 text-[11px] font-semibold text-muted-foreground">{label}</div>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        className="num-tnum w-full rounded-xl bg-surface px-3 py-2.5 text-[14px] font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      />
    </label>
  );
}
