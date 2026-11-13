import { listingStatsEn } from "@vallo/i18n/en/listing-stats";
import type { Locale } from "@vallo/i18n/core";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { cardStatItems, type StatsFigures } from "@/lib/listings/stats/format";

/**
 * THE CARD'S COUNT LINE (founder, 13 November 2026): "1.2k views  24 saves",
 * one quiet muted line under the card's facts, each with its small glyph in
 * brand blue, tabular digits. Its own line, never a cell of the facts row, so
 * it can never push the facts to wrap at 390; it wraps on its own if it must.
 * Views only from ten, saves from one, never a zero, nothing on an example
 * or without figures (`cardStatItems`). Server and client safe.
 */
export function CardCounts({
  stats,
  isDemo,
  locale,
  className,
}: {
  stats: StatsFigures | null | undefined;
  isDemo: boolean;
  locale: Locale;
  className?: string;
}) {
  const items = cardStatItems({ isDemo, stats, locale });
  if (!items) return null;
  return (
    <p
      className={["nf-sc__sub nf-numeric text-[var(--nf-content-muted)]", className ?? ""].filter(Boolean).join(" ")}
      data-testid="card-counts"
      aria-label={listingStatsEn.rowLabel}
    >
      {items.map((item) => (
        <span key={item.key} className="inline-flex items-center gap-3xs whitespace-nowrap" data-stat={item.key}>
          <UiIcon name={item.key === "views" ? "eye" : "heart"} size={12} className="shrink-0 text-[var(--nf-brand-primary)]" />
          {item.text === item.full ? (
            <span>{item.text}</span>
          ) : (
            <>
              <span aria-hidden="true">{item.text}</span>
              <span className="sr-only">{item.full}</span>
            </>
          )}
        </span>
      ))}
    </p>
  );
}
