import { Link } from "@tanstack/react-router";
import { fmtKrw, fmtNum, type CryptoAsset, type VerificationLevel, type Bank } from "@/data/format";
import { VerificationBadge } from "./Badges";
import { Star, Zap } from "lucide-react";

export interface AdCardSeller {
  name: string;
  level: VerificationLevel;
  rating: number;
  completionRate: number;
  avgReleaseSec: number;
}

export interface AdCardAd {
  id: string;
  seller: AdCardSeller;
  unitPrice: number;
  asset: CryptoAsset;
  available: number;
  minKrw: number;
  maxKrw: number;
  chain: string;
  banks: Bank[];
}

export function AdCard({ ad }: { ad: AdCardAd }) {
  return (
    <Link
      to="/app/ads/$adId"
      params={{ adId: ad.id }}
      className="card-lift block rounded-2xl border border-border bg-card p-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-bold text-foreground">{ad.seller.name}</span>
            <VerificationBadge level={ad.seller.level} />
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-warning text-warning" />
              {ad.seller.rating.toFixed(1)}
            </span>
            <span>·</span>
            <span>완료율 {ad.seller.completionRate}%</span>
            <span>·</span>
            <span className="inline-flex items-center gap-0.5">
              <Zap className="h-3 w-3" /> {Math.round(ad.seller.avgReleaseSec / 60)}분
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="num-display text-xl text-foreground">₩{fmtNum(ad.unitPrice, 0)}</div>
          <div className="text-[11px] text-muted-foreground">/ 1 {ad.asset}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
        <div className="rounded-lg bg-surface px-2.5 py-1.5">
          <div className="text-muted-foreground">가능 수량</div>
          <div className="font-semibold text-foreground">
            {fmtNum(ad.available)} {ad.asset}
          </div>
        </div>
        <div className="rounded-lg bg-surface px-2.5 py-1.5">
          <div className="text-muted-foreground">한도</div>
          <div className="font-semibold text-foreground">
            {fmtKrw(ad.minKrw)} ~ {fmtKrw(ad.maxKrw)}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
          {ad.chain}
        </span>
        {ad.banks.map((b) => (
          <span
            key={b}
            className="rounded-md bg-surface-strong px-1.5 py-0.5 text-[10px] font-medium text-foreground"
          >
            {b}
          </span>
        ))}
        <div className="ml-auto rounded-lg bg-primary px-3 py-1.5 text-[12px] font-bold text-primary-foreground">
          거래
        </div>
      </div>
    </Link>
  );
}
