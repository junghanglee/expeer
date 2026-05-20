import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { useProfile } from "@/hooks/useProfile";
import { useBankAccounts } from "@/hooks/useBankAccounts";
import { useWallets } from "@/hooks/useWallets";
import { toast } from "sonner";
import { PhoneShell } from "@/components/espeer/PhoneShell";
import { Section, InfoRow } from "@/components/espeer/Section";
import { BigNumber } from "@/components/espeer/BigNumber";
import { VerificationBadge } from "@/components/espeer/Badges";
import { WalletAddressField, type SavedAddress } from "@/components/espeer/WalletAddressField";
import { WalletLinkCard, type LinkedWallet } from "@/components/espeer/WalletLinkCard";
import { BankAccountStepForm } from "@/components/espeer/BankAccountStepForm";
import type { BankAccountEntry } from "@/components/espeer/BankAccountField";
import { useUserReviews, type Review } from "@/hooks/useReviews";
import { fmtNum, type SwapPair, type CryptoAsset } from "@/data/format";
import {
  ChevronRight,
  Bell,
  FileText,
  LogOut,
  ArrowLeftRight,
  Lock,
  Wallet as WalletIcon,
  Building2,
  Plus,
  Check,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/app/profile")({
  head: () => ({ meta: [{ title: "프로필 — EXPEER" }] }),
  component: Profile,
});

// KRW 환전 페어만 노출 (DAI는 P2P 교환 전용)
const PAIRS: SwapPair[] = ["USDT/KRW", "USDC/KRW"];

function Profile() {
  const { user, signOut } = useAuth();
  const { profile } = useProfile();
  const { accounts: bankAccounts, add: addBank } = useBankAccounts();
  const { wallets, add: addWallet } = useWallets();
  const navigate = useNavigate();
  const [pair, setPair] = useState<SwapPair>("USDT/KRW");
  const kycLevel = Math.min(5, Math.max(0, profile?.kyc_level ?? 0)) as 0 | 1 | 2 | 3 | 4 | 5;
  const displayName = profile?.real_name ?? profile?.nickname ?? "사용자";
  const completionRate =
    profile?.kyc_status === "approved"
      ? 100
      : profile?.kyc_status === "pending"
        ? 70
        : kycLevel > 0
          ? 40
          : 0;
  const [savedAddrs, setSavedAddrs] = useState<SavedAddress[]>([]);
  const [newAddrAsset, setNewAddrAsset] = useState<CryptoAsset>("USDT");
  const [newAddr, setNewAddr] = useState("");

  // 실제 DB 지갑을 LinkedWallet 형태로 매핑
  const linkedWallets: LinkedWallet[] = useMemo(
    () =>
      wallets.map((w) => ({
        id: w.id,
        asset: w.asset as CryptoAsset,
        network: w.network,
        address: w.address,
        balance: undefined,
        ownershipVerified: true,
        isPrimary: w.is_primary,
      })),
    [wallets],
  );
  const [showWalletLink, setShowWalletLink] = useState(false);

  // 실제 DB 계좌를 BankAccountEntry로 매핑
  const bankList: BankAccountEntry[] = useMemo(
    () =>
      bankAccounts.map((b) => ({
        id: b.id,
        bank: b.bank_name as BankAccountEntry["bank"],
        number: b.account_number,
        holder: b.account_holder,
        verified: true,
      })),
    [bankAccounts],
  );
  const [showBankForm, setShowBankForm] = useState(false);

  useEffect(() => {
    const v = window.localStorage.getItem("expeer.defaultPair") as SwapPair | null;
    if (v && PAIRS.includes(v)) setPair(v);
  }, []);

  const choose = (p: SwapPair) => {
    setPair(p);
    window.localStorage.setItem("expeer.defaultPair", p);
  };

  const removeAddr = (id: string) => setSavedAddrs((prev) => prev.filter((a) => a.id !== id));

  return (
    <PhoneShell>
      <header className="flex items-center justify-between px-5 pb-2 pt-6">
        <h1 className="text-[22px] font-extrabold text-foreground">프로필</h1>
      </header>

      <div className="px-5 pt-2">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">
            {(profile?.nickname ?? profile?.email ?? "U").slice(0, 1).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[16px] font-bold text-foreground">
                {profile?.nickname ?? "사용자"}
              </span>
              <VerificationBadge level={kycLevel} />
            </div>
            <div className="text-[12px] text-muted-foreground">
              {profile?.email ?? user?.email ?? ""}
            </div>
          </div>
        </div>
      </div>

      <Section>
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-card p-4">
          <Stat
            label="평점"
            value={
              profile && Number(profile.rating) > 0 ? `★ ${Number(profile.rating).toFixed(2)}` : "—"
            }
          />
          <Stat label="총 거래" value={`${profile?.trade_count ?? 0}건`} />
          <Stat label="완료율" value={`${completionRate}%`} />
        </div>
      </Section>

      {user && <ReceivedReviewsSection userId={user.id} />}

      <Section title="검증 레벨">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-end justify-between">
            <BigNumber value={`Lv.${kycLevel}`} unit="/ 5" size="lg" tone="primary" />
            <span className="text-[12px] font-semibold text-muted-foreground">
              {kycLevel >= 5 ? "최고 레벨" : `Lv.${kycLevel + 1}까지 ${5 - kycLevel}단계`}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(kycLevel / 5) * 100}%` }}
            />
          </div>
          <div className="mt-3 text-[12px] text-muted-foreground">
            {profile?.kyc_status === "approved"
              ? "계좌 인증이 승인되어 거래 준비가 완료되었습니다."
              : "환전 계좌인증을 마치면 거래 신뢰도가 올라갑니다."}
          </div>
        </div>
      </Section>

      {/* 환전 계좌인증 — 매수 시에만 필요 */}
      <Section title="환전 계좌인증">
        <KycStatusCard status={profile?.kyc_status ?? "none"} />
      </Section>
      <Section
        title="연결된 스테이블코인 지갑"
        action={
          <button
            onClick={() => setShowWalletLink((v) => !v)}
            className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary"
          >
            <Plus className="h-3 w-3" /> {showWalletLink ? "닫기" : "지갑 연결"}
          </button>
        }
      >
        <div className="space-y-2">
          {linkedWallets.map((w) => (
            <div key={w.id} className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <WalletIcon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] font-bold text-foreground">{w.asset}</span>
                    <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                      {w.network}
                    </span>
                    {w.isPrimary && (
                      <span className="rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        기본
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground num-tnum">
                    {w.address.slice(0, 10)}…{w.address.slice(-8)}
                  </div>
                </div>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-bold text-success">
                  <Check className="h-3 w-3" /> 소유권
                </span>
              </div>
              {w.balance != null && (
                <div className="mt-3 rounded-xl bg-surface p-3">
                  <div className="text-[11px] font-semibold text-muted-foreground">잔액</div>
                  <BigNumber value={`${fmtNum(w.balance, 2)} ${w.asset}`} size="md" />
                </div>
              )}
            </div>
          ))}
          {showWalletLink && (
            <WalletLinkCard
              saved={savedAddrs}
              onSaveAddress={(entry) => setSavedAddrs((prev) => [entry, ...prev])}
              onLink={async (w) => {
                try {
                  await addWallet({
                    asset: w.asset,
                    network: w.network,
                    address: w.address,
                    label: null,
                    is_primary: linkedWallets.length === 0,
                  });
                  toast.success("지갑이 연결되었습니다");
                  setShowWalletLink(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "지갑 연결 실패");
                }
              }}
            />
          )}
        </div>
      </Section>

      {/* 지갑 주소록(화이트리스트) — P2P교환에서 자동완성/검증 */}
      <Section title="지갑 주소록 (화이트리스트)">
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="space-y-1.5">
            {savedAddrs.length === 0 && (
              <div className="rounded-xl bg-surface px-3 py-3 text-center text-[11px] text-muted-foreground">
                등록된 주소가 없습니다.
              </div>
            )}
            {savedAddrs.map((a) => (
              <div key={a.id} className="flex items-center gap-2 rounded-xl bg-surface px-2.5 py-2">
                <span className="rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-extrabold text-background">
                  {a.asset}
                </span>
                <div className="flex-1">
                  <div className="text-[12px] font-bold text-foreground">{a.label}</div>
                  <div className="num-tnum text-[10px] text-muted-foreground">
                    {a.address.slice(0, 10)}…{a.address.slice(-8)}
                  </div>
                </div>
                <button
                  onClick={() => removeAddr(a.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive-soft hover:text-destructive"
                  aria-label="삭제"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-xl bg-surface p-2.5">
            <div className="text-[11px] font-semibold text-muted-foreground">새 주소 추가</div>
            <div className="mt-1.5 flex items-center gap-1.5">
              <select
                value={newAddrAsset}
                onChange={(e) => setNewAddrAsset(e.target.value as CryptoAsset)}
                className="rounded-md border border-border bg-background px-2 py-1 text-[12px] font-bold"
              >
                {(
                  [
                    "USDT",
                    "USDC",
                    "DAI",
                    "BTC",
                    "ETH",
                    "SOL",
                    "MATIC",
                    "BNB",
                    "XRP",
                  ] as CryptoAsset[]
                ).map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div className="mt-2">
              <WalletAddressField
                asset={newAddrAsset}
                value={newAddr}
                onChange={setNewAddr}
                saved={savedAddrs}
                label="주소 (체인별 형식 자동검증)"
                onSave={(entry) => {
                  setSavedAddrs((prev) => [entry, ...prev]);
                  setNewAddr("");
                }}
              />
            </div>
            <div className="mt-1 text-[10px] text-muted-foreground">
              ※ EXPEER는 지갑을 생성하지 않습니다. 외부 지갑 주소만 등록·검증합니다.
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="등록된 입금 계좌"
        action={
          <button
            onClick={() => setShowBankForm((v) => !v)}
            className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary"
          >
            <Plus className="h-3 w-3" /> {showBankForm ? "닫기" : "계좌 추가"}
          </button>
        }
      >
        <div className="space-y-2">
          {bankList.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[14px] font-bold text-foreground">{b.bank}</span>
                </div>
                <div className="text-[11px] text-muted-foreground num-tnum">
                  {b.number} · {b.holder}
                </div>
              </div>
              <span
                className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  b.verified
                    ? "bg-success-soft text-success"
                    : "bg-warning-soft text-warning-foreground"
                }`}
              >
                <Check className="h-3 w-3" /> {b.verified ? "실명·사본" : "검증 대기"}
              </span>
            </div>
          ))}
          {showBankForm && (
            <BankAccountStepForm
              expectedHolder={displayName}
              onSubmit={async (entry) => {
                try {
                  await addBank({
                    bank_name: entry.bank,
                    account_number: entry.number,
                    account_holder: entry.holder,
                    is_primary: bankList.length === 0,
                  });
                  toast.success("계좌가 등록되었습니다");
                  setShowBankForm(false);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "계좌 등록 실패");
                }
              }}
            />
          )}
        </div>
      </Section>

      {/* 기본 환전 페어 + 비수탁 안내 통합 */}
      <Section title="환전 기본 설정">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="h-4 w-4 text-primary" />
            <span className="text-[12px] font-semibold text-foreground">
              P2P 환전소 진입 시 기본 페어
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {PAIRS.map((p) => {
              const active = p === pair;
              return (
                <button
                  key={p}
                  onClick={() => choose(p)}
                  className={`rounded-xl py-2.5 text-[12px] font-extrabold transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground hover:bg-surface-strong"
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl bg-primary-soft/60 p-3">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <p className="text-[11px] leading-relaxed text-foreground/80">
              <b>Zero-Custody</b> · EXPEER는 코인·원화를 보관하지 않아요. 자산은 내 지갑·내 계좌에
              머물고 매칭 시점에만 컨트랙트가 락업됩니다.
            </p>
          </div>
        </div>
      </Section>

      <Section title="설정">
        <div className="rounded-2xl border border-border bg-card px-4">
          <Link to="/app/fees" className="flex w-full items-center gap-3 py-3.5 text-left">
            <FileText className="h-4 w-4 text-foreground" />
            <span className="flex-1 text-[14px] font-semibold text-foreground">수수료 내역</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="h-px bg-border" />
          <Link to="/app/settings" className="flex w-full items-center gap-3 py-3.5 text-left">
            <Bell className="h-4 w-4 text-foreground" />
            <span className="flex-1 text-[14px] font-semibold text-foreground">
              알림·보안·언어·약관
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </Link>
          <div className="h-px bg-border" />
          <SettingRow
            icon={LogOut}
            label="로그아웃"
            tone="danger"
            onClick={async () => {
              await signOut();
              toast.success("로그아웃되었습니다");
              navigate({ to: "/onboarding/login" });
            }}
          />
        </div>
      </Section>

      <div className="h-6" />
    </PhoneShell>
  );
}

function KycStatusCard({ status }: { status: string }) {
  const config: Record<string, { label: string; tone: string; desc: string; cta: string }> = {
    none: {
      label: "미인증",
      tone: "bg-warning-soft text-warning-foreground",
      desc: "코인 매수(원화 송금) 주문을 위해 환전 계좌인증을 완료해주세요.",
      cta: "카메라로 1분 인증",
    },
    pending: {
      label: "검토 중",
      tone: "bg-primary-soft text-primary",
      desc: "관리자가 검토 중입니다. 결과는 알림으로 전달됩니다.",
      cta: "신청 내역 보기",
    },
    approved: {
      label: "승인 완료",
      tone: "bg-success-soft text-success",
      desc: "환전 계좌인증이 완료되었습니다. 코인 매수 거래를 이용할 수 있습니다.",
      cta: "",
    },
    rejected: {
      label: "반려",
      tone: "bg-destructive-soft text-destructive",
      desc: "신청이 반려되었습니다. 다시 제출해주세요.",
      cta: "재신청하기",
    },
  };
  const c = config[status] ?? config.none;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-bold text-foreground">환전 계좌인증 상태</span>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${c.tone}`}>
          {c.label}
        </span>
      </div>
      <p className="mt-2 text-[12px] text-muted-foreground">{c.desc}</p>
      {c.cta && (
        <Link
          to="/onboarding/verify"
          className="mt-3 block rounded-xl bg-primary py-2.5 text-center text-[13px] font-bold text-primary-foreground"
        >
          {c.cta}
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="num-display text-[15px] text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

function ReceivedReviewsSection({ userId }: { userId: string }) {
  const { reviews, loading } = useUserReviews(userId);
  if (loading) return null;
  if (reviews.length === 0) {
    return (
      <Section title="받은 리뷰">
        <div className="rounded-2xl border border-border bg-card p-4 text-center text-[12px] text-muted-foreground">
          아직 받은 리뷰가 없어요
        </div>
      </Section>
    );
  }
  return (
    <Section title={`받은 리뷰 (${reviews.length})`}>
      <div className="space-y-2">
        {reviews.slice(0, 5).map((r: Review) => (
          <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ReviewStar key={i} filled={i < r.rating} />
                ))}
              </div>
              <span className="text-[11px] text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString("ko-KR")}
              </span>
            </div>
            {r.comment && <div className="mt-1.5 text-[12px] text-foreground">"{r.comment}"</div>}
          </div>
        ))}
      </div>
    </Section>
  );
}

function ReviewStar({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-3.5 w-3.5 ${filled ? "fill-warning text-warning" : "fill-none text-muted-foreground"}`}
      stroke="currentColor"
      strokeWidth="2"
    >
      <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9 12 2" />
    </svg>
  );
}

function SettingRow({
  icon: Icon,
  label,
  right,
  tone,
  onClick,
}: {
  icon: typeof Bell;
  label: string;
  right?: string;
  tone?: "danger";
  onClick?: () => void;
}) {
  const c = tone === "danger" ? "text-destructive" : "text-foreground";
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 py-3.5 text-left">
      <Icon className={`h-4 w-4 ${c}`} />
      <span className={`flex-1 text-[14px] font-semibold ${c}`}>{label}</span>
      {right && <span className="text-[12px] text-muted-foreground">{right}</span>}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

function BalanceCell({ asset, balance }: { asset: string; balance: number }) {
  return (
    <div className="rounded-xl bg-surface p-3">
      <div className="text-[11px] font-semibold text-muted-foreground">{asset}</div>
      <BigNumber value={fmtNum(balance, 2)} size="md" />
    </div>
  );
}

function AddButton({ label }: { label: string }) {
  return (
    <button className="inline-flex items-center gap-0.5 rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-bold text-primary">
      <Plus className="h-3 w-3" /> {label}
    </button>
  );
}

function _unused() {
  return InfoRow;
}
