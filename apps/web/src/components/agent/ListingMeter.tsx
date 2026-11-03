import { Progress } from "@/components/ui/Progress";
import { ButtonLink } from "@/components/ui/Button";
import type { Completeness } from "@/lib/agent/completeness";
import type { Dictionary, Locale } from "@vallo/i18n/core";

export type MeterCopy = Dictionary["agentListings"]["workspace"]["completeness"];

/**
 * THE COMPLETENESS METER on a listing's card (backlog row 15): a quiet bar,
 * "5 of 8 done", and the one next step as a link into the wizard. Steps done
 * out of steps, never a score (`lib/agent/completeness.ts`). Server-safe.
 */
export function ListingMeter({
  completeness,
  listingId,
  editable,
  copy: c,
  locale,
}: {
  completeness: Completeness;
  listingId: string;
  /** The listing can still be edited in the wizard: the next step becomes a link. */
  editable: boolean;
  copy: MeterCopy;
  locale: Locale;
}) {
  const { done, total, next } = completeness;
  const words = c.progress.replace("{done}", String(done)).replace("{total}", String(total));
  return (
    <div className="mt-xs" data-testid="listing-meter">
      <Progress value={done} max={total} size="sm" label={c.label} valueText={words} locale={locale} tone={done === total ? "success" : "brand"} />
      <p className="mt-2xs flex flex-wrap items-center gap-x-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
        <span className="nf-numeric">{words}</span>
        {next === null ? (
          <span>{c.allDone}</span>
        ) : editable ? (
          <ButtonLink href={`/agent/list?id=${listingId}`} variant="quiet" size="sm" arrow data-testid="listing-meter-next">
            {c.next[next]}
          </ButtonLink>
        ) : (
          <span>{c.next[next]}</span>
        )}
      </p>
    </div>
  );
}
