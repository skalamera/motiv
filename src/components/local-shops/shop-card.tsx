"use client";

import { ExternalLink, MapPin, Phone, Star, Globe } from "lucide-react";
import type { Shop } from "@/types/local-shops";
import { cn } from "@/lib/utils";

type Props = {
  shop: Shop;
  selected: boolean;
  onClick: () => void;
};

function StarRow({
  source,
  rating,
  reviews,
}: {
  source: string;
  rating: number | null;
  reviews: number | null;
}) {
  if (rating === null) return null;
  return (
    <span className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground font-medium">{source}</span>
      <Star className="size-3 fill-yellow-400 text-yellow-400" />
      <span className="font-semibold">{rating.toFixed(1)}</span>
      {reviews !== null && (
        <span className="text-muted-foreground">({reviews.toLocaleString()})</span>
      )}
    </span>
  );
}

function ScoreBadge({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className,
      )}
    >
      {label}: {value}
    </span>
  );
}

export function ShopCard({ shop, selected, onClick }: Props) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`;
  const totalReviews =
    (shop.googleReviews ?? 0) + (shop.yelpReviews ?? 0);

  const confidenceLabel =
    shop.confidenceWeight > 0
      ? `+${shop.confidenceWeight.toFixed(2)}`
      : shop.confidenceWeight.toFixed(2);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn(
        "group cursor-pointer rounded-xl border p-4 transition-all",
        selected
          ? "border-orange-500/60 bg-orange-500/5 shadow-[0_0_0_1px_theme(colors.orange.500/0.3)]"
          : "border-border/50 bg-card hover:border-border",
      )}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Rank badge */}
        <div
          className={cn(
            "flex size-9 shrink-0 items-center justify-center rounded-lg text-sm font-black",
            shop.rank === 1
              ? "bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30"
              : shop.rank === 2
                ? "bg-slate-400/20 text-slate-300 ring-1 ring-slate-400/30"
                : shop.rank === 3
                  ? "bg-amber-700/20 text-amber-600 ring-1 ring-amber-700/30"
                  : "bg-muted text-muted-foreground",
          )}
        >
          #{shop.rank}
        </div>

        {/* Name + address */}
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-tight">{shop.name}</h3>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="mt-0.5 flex items-start gap-1 text-xs text-blue-400 hover:underline"
          >
            <MapPin className="mt-0.5 size-3 shrink-0" />
            <span>{shop.address}</span>
            <ExternalLink className="mt-0.5 size-2.5 shrink-0 opacity-60" />
          </a>
        </div>

        {/* Distance */}
        <div className="shrink-0 text-right">
          <span className="text-sm font-bold tabular-nums">{shop.distance.toFixed(1)}</span>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">miles</p>
        </div>
      </div>

      {/* Scores row */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <StarRow source="Google" rating={shop.googleRating} reviews={shop.googleReviews} />
        {shop.yelpRating !== null && (
          <>
            <span className="text-border">·</span>
            <StarRow source="Yelp" rating={shop.yelpRating} reviews={shop.yelpReviews} />
          </>
        )}
        <span className="text-border">·</span>
        <span className="text-muted-foreground text-xs">{totalReviews.toLocaleString()} total reviews</span>
      </div>

      {/* Algorithm scores */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        <ScoreBadge
          label="Base"
          value={shop.baseScore.toFixed(2)}
          className="bg-blue-500/10 text-blue-400"
        />
        <ScoreBadge
          label="Confidence"
          value={confidenceLabel}
          className={
            shop.confidenceWeight >= 0
              ? "bg-green-500/10 text-green-400"
              : "bg-red-500/10 text-red-400"
          }
        />
        <ScoreBadge
          label="Final Score"
          value={shop.finalScore.toFixed(2)}
          className="bg-orange-500/10 text-orange-400 font-black"
        />
      </div>

      {/* Chips row */}
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-medium text-purple-400 ring-1 ring-purple-500/20">
          {shop.bestFor}
        </span>
        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {shop.commuteDifficulty}
        </span>
      </div>

      {/* Specialist capability */}
      <p className="mt-3 text-xs font-semibold text-foreground/80">
        Specialist Capability
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
        {shop.specialistCapability}
      </p>

      {/* Technical competency */}
      <p className="mt-2.5 text-xs font-semibold text-foreground/80">
        Technical Competency
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
        {shop.technicalCompetency}
      </p>

      {/* Sentiment */}
      <p className="mt-2.5 text-xs font-semibold text-foreground/80">
        Customer Consensus
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground italic leading-relaxed">
        &ldquo;{shop.sentimentSummary}&rdquo;
      </p>

      {/* Ranking analysis */}
      <p className="mt-2.5 text-xs font-semibold text-foreground/80">
        Ranking Analysis
      </p>
      <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
        {shop.rankingAnalysis}
      </p>

      {/* Footer links */}
      {(shop.phone ?? shop.website) ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border/40 pt-3">
          {shop.phone ? (
            <a
              href={`tel:${shop.phone}`}
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="size-3" />
              {shop.phone}
            </a>
          ) : null}
          {shop.website ? (
            <a
              href={shop.website}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-xs text-blue-400 hover:underline"
            >
              <Globe className="size-3" />
              Website
              <ExternalLink className="size-2.5 opacity-60" />
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
