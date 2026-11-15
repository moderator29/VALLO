import { MetaStrip } from "@/components/ui/MetaStrip";
import { UiIcon, type UiIconName } from "@/design-system/icons/UiIcon";
import type { StatItem, StatKey } from "@/lib/listings/stats/format";

/**
 * THE LISTING STATS ROW (founder, 13 November 2026): "12 days on Vallo |
 * 340 views | 18 saves", in Vallo's own meta strip (`MetaStrip`, the 13px
 * muted items split by hairlines in one card-border box), each item led by
 * its line glyph in brand blue, figures in tabular digits. Quiet by design:
 * a fact about the listing, not a call to action.
 *
 * `compact` drops the box for the lister's own rows. The items arrive already
 * decided and worded (`lib/listings/stats/format.ts`); an empty or null list
 * draws nothing. Where a figure is compacted ("1.2k views") a screen reader
 * hears the whole number. Server and client safe.
 */
const GLYPH: Record<StatKey, UiIconName> = { days: "calendar-clock", views: "eye", saves: "heart", shares: "share" };

export function ListingStatsRow({
  items,
  label,
  compact = false,
  className,
}: {
  items: readonly StatItem[] | null;
  label: string;
  compact?: boolean;
  className?: string;
}) {
  if (!items || items.length === 0) return null;
  return (
    <div role="group" aria-label={label} className={className} data-testid="listing-stats">
      <MetaStrip bare={compact}>
        {items.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2xs" data-stat={item.key}>
            <UiIcon name={GLYPH[item.key]} size={14} className="shrink-0 text-[var(--nf-brand-primary)]" />
            {item.text === item.full ? (
              <span className="nf-numeric">{item.text}</span>
            ) : (
              <>
                <span className="nf-numeric" aria-hidden="true">
                  {item.text}
                </span>
                <span className="sr-only">{item.full}</span>
              </>
            )}
          </span>
        ))}
      </MetaStrip>
    </div>
  );
}
