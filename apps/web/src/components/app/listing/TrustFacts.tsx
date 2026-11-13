import Link from "next/link";
import type { ReactNode } from "react";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { ButtonLink } from "@/components/ui/Button";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { DisclosureInline } from "@/components/app/DisclosureInline";
import { TrustChecks, type TrustCheckGroup, type TrustCheckLabels } from "@/components/app/trust/TrustChecks";
import { spaceChecks, spaceExplainer } from "@/lib/trust/checks";
import type { ProofLine } from "@/lib/trust/proof-strip";
import type { EarnedTrust } from "./earned-trust";
import "@/components/app/trust/trust-checks.css";

/**
 * THE SPACE'S TRUST FACTS, AS CHECKS A PERSON CAN OPEN (north star 12 point
 * 15; handoff Stage 5; rebuilt 13 November 2026 on the founder's ask for real
 * "reasons to trust").
 *
 * "Inspected 12 July 2026 is a fact a reader can weigh; a tick is a promise"
 * (`docs/PRODUCT.md` section 6). That has not changed. What changed is that a
 * dated fact used to be a line of grey text and is now a row that opens: the
 * date, who did it, what was looked at and what it does not prove
 * (`components/app/trust/TrustChecks.tsx`), and the rows are split by what
 * was looked at, the space or the person who listed it (`lib/trust/checks.ts`).
 *
 * WHAT IT NEVER DRAWS. A check with no date is not a row against this space:
 * absent is absent, never "Not inspected" and never a crossed-out mark,
 * because a null must never read as a negative. An example row reaches this
 * with every field already cleared by `earnedTrust` and no proof lines, so it
 * draws exactly what a real unchecked listing draws, and nothing that says
 * "example" (D24).
 *
 * WHEN NOTHING IS DATED, THE PAGE STILL TEACHES. The full page used to print
 * one sentence. It now says plainly that nothing is on record, offers the one
 * person who can answer, and lists the checks Vallo can record with how each
 * is earned. Those rows are about Vallo, not about this space: they carry no
 * date, no tick and no cross.
 *
 * TWO SHAPES. `summary` sits on the listing page: up to three dated rows and
 * the door to the inner page. `full` IS the inner page's body.
 *
 * `lines` is the proof strip's own output. The listing page does not pass it
 * yet (it hands in the rendered strip), so without it the summary draws the
 * two staff dates as rows and the strip beneath them, as before.
 */

/** How many dated rows the listing page's summary carries before the door. */
const SUMMARY_ROWS = 3;

export function TrustFacts({
  listingId,
  trust,
  strip,
  proofCount,
  lines,
  locale,
  t,
  variant = "summary",
  askHref = null,
}: {
  listingId: string;
  trust: Pick<EarnedTrust, "inspectedAt" | "addressCheckedAt">;
  /** `<ProofStrip variant="full" />`, mounted by the page. Drawn only when `lines` is not handed in. */
  strip: ReactNode;
  /** How many lines that strip draws; zero means it draws nothing. */
  proofCount: number;
  /** The proof strip's lines themselves, so they are drawn as rows that open. */
  lines?: readonly ProofLine[];
  locale: Locale;
  t: Dictionary;
  variant?: "summary" | "full";
  /** Full page only: where "Ask the lister a question" leads. Null on an example row, which has nobody to ask. */
  askHref?: string | null;
}) {
  const copy = t.trustReasons;
  const words = copy.space;
  const labels: TrustCheckLabels = copy.sheet;
  const checks = spaceChecks(
    { inspectedAt: trust.inspectedAt, addressCheckedAt: trust.addressCheckedAt, lines: lines ?? [] },
    copy,
    t.trustVisible.proof,
    locale,
  );
  /* The strip stands in for the lines only while the page has not handed
     them over; with them, every line is already a row above. */
  const legacyStrip = lines === undefined && proofCount > 0;
  const dated = checks.space.length + checks.lister.length + (legacyStrip ? proofCount : 0);
  const onRecord = (count: number) =>
    count === 1 ? words.onRecordOne : words.onRecord.replace("{count}", String(count));

  if (variant === "summary") {
    const rows = [...checks.space, ...checks.lister].slice(0, SUMMARY_ROWS);
    return (
      <div className="nf-trust" data-testid="trust-facts">
        {dated === 0 ? (
          <p className="nf-trust__lede" data-testid="trust-none">
            {words.summaryNone}
          </p>
        ) : (
          <>
            <TrustChecks groups={[{ key: "summary", rows }]} labels={labels} testId="trust-summary" />
            {legacyStrip && <div className="mt-row">{strip}</div>}
          </>
        )}
        <Link href={`/listing/${listingId}/trust`} className="nf-trust__door" data-testid="trust-door">
          {/* The section above carries the question as its heading, so the
              door says only where it goes. */}
          <span className="nf-trust__door-title min-w-0">{dated === 0 ? words.summaryDoorNone : words.summaryDoor}</span>
          <UiIcon name="chevron-right" size={20} className="shrink-0" />
        </Link>
      </div>
    );
  }

  const explainer = spaceExplainer(copy, t.trustVisible.proof);
  const groups: TrustCheckGroup[] = [
    { key: "space", label: words.spaceGroup, count: onRecord(checks.space.length), rows: checks.space },
    { key: "lister", label: words.listerGroup, count: onRecord(checks.lister.length), rows: checks.lister },
  ];

  return (
    <div className="nf-trust nf-reasons" data-testid="trust-facts-full">
      {dated === 0 ? (
        <>
          <div className="nf-reasons-empty" data-testid="trust-none">
            <h2 className="nf-reasons-empty__title">{words.emptyTitle}</h2>
            <p className="nf-reasons-empty__body">{words.emptyBody}</p>
            {askHref ? (
              <ButtonLink
                href={askHref}
                variant="secondary"
                size="md"
                leadingIcon="chat-bubble"
                className="nf-reasons-empty__action"
                data-testid="trust-ask"
              >
                {words.emptyAction}
              </ButtonLink>
            ) : null}
          </div>
          <section className="nf-reasons-earn" aria-labelledby="trust-earn-title" data-testid="trust-earn">
            <h2 id="trust-earn-title" className="nf-reasons-earn__title">
              {words.earnTitle}
            </h2>
            <p className="nf-reasons-earn__lede">{words.earnLede}</p>
            <TrustChecks groups={[{ key: "explainer", rows: explainer }]} labels={labels} testId="trust-explainer" />
          </section>
        </>
      ) : (
        <>
          <p className="nf-reasons__lede">{words.lede}</p>
          <TrustChecks groups={groups} labels={labels} />
          {legacyStrip && <div>{strip}</div>}
          <DisclosureInline title={words.earnMore} hint={words.earnMoreHint} data-testid="trust-earn">
            <p className="nf-reasons-earn__lede">{words.earnLede}</p>
            <div className="mt-row">
              <TrustChecks groups={[{ key: "explainer", rows: explainer }]} labels={labels} testId="trust-explainer" />
            </div>
          </DisclosureInline>
        </>
      )}
    </div>
  );
}
