import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { Section } from "@/components/espeer/Section";
import { ArrowLeftRight, ArrowLeft, Plus, ShieldCheck, Lock, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useWallets } from "@/hooks/useWallets";
import { createOffer } from "@/hooks/useOffers";
import { toast } from "sonner";
import { z } from "zod";

const searchSchema = z.object({
  side: z.enum(["sell", "buy"]).optional(),
  asset: z.string().optional(),
  give: z.enum(["KRW", "USDT", "USDC", "DAI"]).optional(),
  receive: z.enum(["KRW", "USDT", "USDC", "DAI"]).optional(),
  price: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? undefined : String(value))),
  fiatAmount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? undefined : String(value))),
  coinAmount: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? undefined : String(value))),
  minOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? undefined : String(value))),
  maxOrder: z
    .union([z.string(), z.number()])
    .optional()
    .transform((value) => (value === undefined ? undefined : String(value))),
});

export const Route = createFileRoute("/app/selling/new")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "오퍼 등록 — EXPEER" }] }),
  component: NewOffer,
});

const ASSETS = ["USDT", "USDC", "DAI", "BTC", "ETH", "SOL", "BNB", "XRP", "MATIC"] as const;
type OfferAsset = (typeof ASSETS)[number];
const ASSET_LABELS: Record<OfferAsset, { badge: string; fullName: string }> = {
  USDT: { badge: "₮", fullName: "Tether USD" },
  USDC: { badge: "$", fullName: "USD Coin" },
  DAI: { badge: "◈", fullName: "Dai Stablecoin" },
  BTC: { badge: "₿", fullName: "Bitcoin" },
  ETH: { badge: "Ξ", fullName: "Ethereum" },
  SOL: { badge: "◎", fullName: "Solana" },
  BNB: { badge: "B", fullName: "BNB" },
  XRP: { badge: "X", fullName: "XRP" },
  MATIC: { badge: "M", fullName: "Polygon" },
};
type OfferPickerAsset = OfferAsset | "KRW";
const PICKER_ASSETS: OfferPickerAsset[] = ["KRW", ...ASSETS];
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
  const search = Route.useSearch();
  const { user } = useAuth();
  const { accounts } = useBankAccounts();
  const { wallets } = useWallets();

  const initialAsset = ASSETS.includes(search.asset as OfferAsset)
    ? (search.asset as OfferAsset)
    : "USDC";
  const giveSearch = search.give;
  const receiveSearch = search.receive;
  const initialGive = giveSearch ?? (search.side === "buy" ? "KRW" : initialAsset);
  const initialReceive = receiveSearch ?? (initialGive === "KRW" ? initialAsset : "KRW");
  const [giveAsset, setGiveAsset] = useState<OfferPickerAsset>(initialGive);
  const [receiveAsset, setReceiveAsset] = useState<OfferPickerAsset>(
    initialReceive === initialGive ? "KRW" : initialReceive,
  );
  const [pickerOpen, setPickerOpen] = useState<"give" | "receive" | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const side: "sell" | "buy" = giveAsset === "KRW" ? "buy" : "sell";
  const asset = (giveAsset === "KRW" ? receiveAsset : giveAsset) as OfferAsset;
  const tone = side === "buy" ? "success" : "destructive";
  const [network, setNetwork] = useState<string>("Base Sepolia");
  const initialMaxOrder = search.maxOrder ?? search.coinAmount ?? "1000";
  const [price, setPrice] = useState(search.price ?? "1380");
  const [coinAmount, setCoinAmount] = useState(search.coinAmount ?? "1000");
  const [fiatAmount, setFiatAmount] = useState(search.fiatAmount ?? "1380000");
  const [orderMode, setOrderMode] = useState<"full" | "partial">(
    search.minOrder && search.minOrder === initialMaxOrder ? "full" : "partial",
  );
  const [minOrder, setMinOrder] = useState(search.minOrder ?? "10");
  const [maxOrder, setMaxOrder] = useState(initialMaxOrder);
  const [methods, setMethods] = useState<string[]>(["bank_transfer"]);
  const [terms, setTerms] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 자산 변경 시 네트워크 재설정
  useEffect(() => {
    setNetwork(NETWORKS[asset][0]);
  }, [asset]);

  const recalcFiatFromCoin = (nextCoin: string, nextPrice = price) => {
    setCoinAmount(nextCoin);
    const coin = Number(nextCoin);
    const unit = Number(nextPrice);
    setFiatAmount(coin > 0 && unit > 0 ? String(Math.round(coin * unit)) : "");
  };
  const updatePrice = (nextPrice: string) => {
    setPrice(nextPrice);
    recalcFiatFromCoin(coinAmount, nextPrice);
  };
  const setFullOrder = () => {
    setOrderMode("full");
    setMinOrder(coinAmount || "0");
    setMaxOrder(coinAmount || "0");
  };
  const setPartialOrder = () => {
    setOrderMode("partial");
    setMinOrder((prev) => (prev && Number(prev) > 0 ? prev : "10"));
    setMaxOrder(coinAmount || maxOrder);
  };

  const assetWallets = useMemo(
    () => wallets.filter((w) => w.asset === asset && w.network === network),
    [wallets, asset, network],
  );
  const primaryBank = accounts[0];
  const primaryWallet = assetWallets[0];
  const totalFiat = Number(fiatAmount);

  const valid =
    Number(price) > 0 &&
    Number(coinAmount) > 0 &&
    Number(fiatAmount) > 0 &&
    Number(minOrder) > 0 &&
    Number(maxOrder) >= Number(minOrder) &&
    Number(maxOrder) <= Number(coinAmount) &&
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
      const offer = await createOffer(user.id, {
        kind: "fiat",
        side,
        asset,
        network,
        fiat: "KRW",
        price: Number(price),
        total_amount: Number(coinAmount),
        min_order:
          orderMode === "full" ? Number(fiatAmount) : Math.round(Number(minOrder) * Number(price)),
        max_order:
          orderMode === "full" ? Number(fiatAmount) : Math.round(Number(maxOrder) * Number(price)),
        payment_methods: methods,
        terms: terms.trim() || null,
        status: "active",
      });
      toast.success("오퍼가 등록되었습니다. 마켓 상세로 이동합니다.");
      navigate({ to: "/app/ads/$adId", params: { adId: offer.id } });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "등록 실패";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMethod = (m: string) =>
    setMethods((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));

  const selectGive = (next: OfferPickerAsset) => {
    setGiveAsset(next);
    setReceiveAsset(next === "KRW" ? asset : "KRW");
    setPickerOpen(null);
  };
  const selectReceive = (next: OfferPickerAsset) => {
    setReceiveAsset(next);
    setGiveAsset(next === "KRW" ? asset : "KRW");
    setPickerOpen(null);
  };
  const switchAssets = () => {
    setGiveAsset(receiveAsset);
    setReceiveAsset(giveAsset);
    setPickerOpen(null);
  };
  const pickerOptions = (target: "give" | "receive"): OfferPickerAsset[] =>
    target === "give" ? PICKER_ASSETS : giveAsset === "KRW" ? [...ASSETS] : ["KRW"];
  const currentPickerOptions = pickerOpen ? pickerOptions(pickerOpen) : [];
  const filteredPickerOptions = currentPickerOptions.filter((item) => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return true;
    const metaName = item === "KRW" ? "대한민국 원" : ASSET_LABELS[item].fullName;
    return item.toLowerCase().includes(q) || metaName.toLowerCase().includes(q);
  });
  const openPicker = (target: "give" | "receive") => {
    setPickerOpen((prev) => (prev === target ? null : target));
    setPickerQuery("");
  };

  return (
    <PhoneShell hideTab>
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-2">
          <Link
            to="/app/selling"
            search={{ from: "new-offer" }}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="leading-tight">
            <div className="text-[15px] font-extrabold text-foreground">오퍼 등록</div>
            <div className="text-[10px] font-semibold text-muted-foreground">
              {side === "sell" ? "내 코인을 팔 판매 오퍼" : "내가 코인을 살 구매 오퍼"}
            </div>
          </div>
        </div>
      </header>

      <div
        className={`mx-4 mt-3 flex items-start gap-2 rounded-xl border p-2.5 ${side === "buy" ? "border-success/20 bg-success-soft text-success" : "border-destructive/20 bg-destructive-soft text-destructive"}`}
      >
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-[11px] leading-relaxed">
          <b>{side === "sell" ? "판매 오퍼" : "구매 오퍼"}</b> · {giveAsset} → {receiveAsset}
        </div>
      </div>

      <Section title="내가 줄 것 / 받을 것">
        <div className="space-y-2 rounded-2xl border border-border bg-card p-2.5">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <OfferAssetActionButton
              label="내가 줄 것 선택"
              value={giveAsset}
              active={pickerOpen === "give"}
              tone={tone}
              onClick={() => openPicker("give")}
            />
            <button
              onClick={switchAssets}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background"
            >
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </button>
            <OfferAssetActionButton
              label="내가 받을 것 선택"
              value={receiveAsset}
              active={pickerOpen === "receive"}
              tone={tone}
              onClick={() => openPicker("receive")}
            />
          </div>
          {pickerOpen && (
            <div className="rounded-2xl border border-border bg-background p-2 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <div className="text-[12px] font-extrabold text-foreground">
                    {pickerOpen === "give" ? "내가 줄 것 선택" : "내가 받을 것 선택"}
                  </div>
                  <div className="text-[10px] font-bold text-muted-foreground">
                    {pickerOpen === "give"
                      ? "KRW 또는 코인을 선택하세요"
                      : "KRW 또는 코인을 선택하세요"}
                  </div>
                </div>
                <button
                  onClick={() => setPickerOpen(null)}
                  className="rounded-full bg-surface px-2 py-1 text-[10px] font-bold text-muted-foreground"
                >
                  닫기
                </button>
              </div>
              <input
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="코인명 검색"
                className="mb-2 h-9 w-full rounded-xl bg-surface px-3 text-[12px] font-bold text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="max-h-60 space-y-1 overflow-y-auto pr-1">
                {filteredPickerOptions.map((item) => {
                  const badge = item === "KRW" ? "₩" : ASSET_LABELS[item].badge;
                  const name = item === "KRW" ? "대한민국 원" : ASSET_LABELS[item].fullName;
                  return (
                    <button
                      key={item}
                      onClick={() =>
                        pickerOpen === "give" ? selectGive(item) : selectReceive(item)
                      }
                      className="flex h-11 w-full items-center justify-between rounded-xl bg-card px-3 text-left active:scale-[0.99]"
                    >
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface text-[11px] text-primary">
                          {badge}
                        </span>
                        <span>
                          <span className="block text-[13px] font-extrabold text-foreground">
                            {item}
                          </span>
                          <span className="block text-[10px] font-bold text-muted-foreground">
                            {name}
                          </span>
                        </span>
                      </span>
                      <span className="text-[11px] font-extrabold text-primary">선택</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </Section>

      <Section title="네트워크">
        <div className="flex flex-wrap gap-1.5">
          {NETWORKS[asset].map((n) => (
            <button
              key={n}
              onClick={() => setNetwork(n)}
              className={`rounded-lg px-3 py-1.5 text-[12px] font-bold ${
                network === n
                  ? side === "buy"
                    ? "bg-success-soft text-success"
                    : "bg-destructive-soft text-destructive"
                  : "bg-surface text-muted-foreground"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </Section>

      <Section title="가격 · 수량">
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_auto] gap-1.5">
            <label className="rounded-xl border border-border bg-card px-3 py-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground">
                <span>{asset} 수량 입력</span>
                <span>{side === "buy" ? "구매" : "판매"}</span>
              </div>
              <input
                inputMode="decimal"
                value={coinAmount}
                onChange={(e) => recalcFiatFromCoin(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder={`${asset} 수량`}
                className="num-tnum h-7 w-full bg-transparent text-[16px] font-extrabold text-foreground outline-none"
              />
            </label>
            <div className="min-w-[108px] rounded-xl bg-surface px-3 py-2 text-right">
              <div className="text-[10px] font-bold text-muted-foreground">예상 원화</div>
              <div className="num-tnum h-7 text-[13px] font-extrabold text-foreground">
                {totalFiat.toLocaleString("ko-KR")}
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card px-3 py-2">
            <div className="text-[10px] font-bold text-muted-foreground">참고 단가</div>
            <div className="num-tnum h-7 text-[13px] font-extrabold text-foreground">
              1 {asset} = {Number(price).toLocaleString("ko-KR")} KRW
            </div>
          </div>
          <div className="rounded-2xl bg-surface p-2">
            <div className="mb-1.5 text-[11px] font-semibold text-muted-foreground">주문 방식</div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={setFullOrder}
                className={`rounded-xl py-2 text-[12px] font-extrabold ${
                  orderMode === "full"
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground"
                }`}
              >
                전체 주문
              </button>
              <button
                onClick={setPartialOrder}
                className={`rounded-xl py-2 text-[12px] font-extrabold ${
                  orderMode === "partial"
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground"
                }`}
              >
                부분 주문 허용
              </button>
            </div>
          </div>
          {orderMode === "partial" && (
            <div className="grid grid-cols-2 gap-2">
              <NumField
                label={`최소 주문 수량 (${asset})`}
                value={minOrder}
                onChange={setMinOrder}
              />
              <NumField
                label={`최대 주문 수량 (${asset})`}
                value={maxOrder}
                onChange={setMaxOrder}
              />
            </div>
          )}
          {orderMode === "full" && (
            <div className="rounded-xl bg-primary-soft px-3 py-2 text-[11px] font-bold text-primary">
              전체 주문 모드: 주문자는 총 {coinAmount || 0} {asset}를 한 번에 거래합니다.
            </div>
          )}
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

      <Section title="등록 요약">
        <div className="rounded-2xl border border-border bg-card px-3.5 py-3 text-[12px]">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted-foreground">오퍼 방향</span>
            <b className={side === "sell" ? "text-destructive" : "text-success"}>
              {side === "sell" ? "판매 오퍼" : "구매 오퍼"}
            </b>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted-foreground">총 거래 가능 금액</span>
            <b className="num-tnum text-foreground">{totalFiat.toLocaleString("ko-KR")} KRW</b>
          </div>
          <div className="h-px bg-border" />
          <div className="flex items-center justify-between py-1.5">
            <span className="text-muted-foreground">등록 기준</span>
            <b className="text-foreground">
              {side === "sell"
                ? primaryWallet
                  ? `${primaryWallet.label || asset + " 지갑"} 확인됨`
                  : `${asset}/${network} 지갑 필요`
                : primaryBank
                  ? `${primaryBank.bank_name} 계좌 확인됨`
                  : "계좌 등록 필요"}
            </b>
          </div>
        </div>
      </Section>

      {side === "sell" && assetWallets.length === 0 && (
        <div className="mx-4 mt-2 rounded-xl bg-warning-soft p-3 text-[11px] text-warning-foreground">
          {asset}/{network} 지갑이 등록되어 있지 않습니다.{" "}
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
          {side === "sell" ? "판매 오퍼 등록하기" : "구매 오퍼 등록하기"}
        </button>
      </div>
    </PhoneShell>
  );
}

function OfferAssetActionButton({
  label,
  value,
  active,
  tone,
  onClick,
}: {
  label: string;
  value: OfferPickerAsset;
  active: boolean;
  tone: "success" | "destructive";
  onClick: () => void;
}) {
  const activeTone =
    tone === "success"
      ? "bg-success text-success-foreground"
      : "bg-destructive text-destructive-foreground";
  return (
    <button
      onClick={onClick}
      className={`flex h-10 items-center justify-center rounded-xl px-2 text-center text-[12px] font-extrabold ${active ? activeTone : "bg-foreground text-background"}`}
    >
      <span>{label}</span>
      <span className="ml-1.5 rounded-full bg-background/15 px-1.5 py-0.5 text-[10px]">
        {value}
      </span>
    </button>
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
    <label className="rounded-xl border border-border bg-card px-3 py-2">
      <div className="text-[10px] font-bold text-muted-foreground">{label}</div>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
        className="num-tnum h-7 w-full bg-transparent text-[16px] font-extrabold text-foreground outline-none"
      />
    </label>
  );
}
