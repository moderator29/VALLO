import { getDictionary, type Locale } from "@vallo/i18n";
import { Reveal } from "@/components/site/Reveal";
import { Section, Stack, TYPE } from "@/components/app/Screen";
import { InspectionSheet } from "@/components/app/inspections/InspectionSheet";
import { InspectionsLive } from "@/components/app/inspections/InspectionsLive";
import { readRentGateFor, readReportsFor } from "@/lib/inspections/report-queries";
import { reportStorageLive } from "@/lib/inspections/report-flag";
import { groupInspections, tagSide } from "@/components/app/inspections/grouping";
import { readNoShowsFor, type InspectionList } from "@/lib/inspections/queries";
import { readListingFacts } from "./inspection-facts";
import { readQuoteLinesFor } from "@/lib/after-gate/quotes";
import { readTruthAnsweredFor } from "@/lib/inspections/truth-queries";
import { readTenancyReviewsDue } from "@/lib/tenancy/review-queries";
import { truthOpenNow } from "@/lib/inspections/truth";
import { SafetyShareControl } from "@/components/app/doors/SafetyShareControl";
import { safetyControlRows } from "@/lib/doors/safety";
import { readMyLiveSafetyShares } from "@/lib/doors/queries";
import { requestNow } from "@/lib/format/when";

/**
 * The inspections on Plans: the Property side's diary, in the anatomy of
 * F6A8A482. It was the whole of `/inspections`, which is folded into
 * `/bookings` (V-76) and now redirects there with `?kind=inspection`.
 *
 * A person can be both sides of this table: the flat they rent and the one
 * they let. Both lists are read by the page (so the dated list above and this
 * board agree), each row is tagged with the side it was read from, which
 * decides the controls and whose move it is, and they show as two groups.
 * OPEN is anything still ahead of you; CLOSED is a record.
 *
 * Each inspection is one sheet: the scheduled listing card, the date and
 * party and state row, the ladder, the notes, and the two actions. The first
 * open one arrives expanded; the rest fold to their card. Every sheet sits
 * under an `ix-<id>` anchor so a row in the dated list can land on it.
 *
 * Either read failing makes the board say so: a list that is half true is not
 * a list somebody can act on. `changed` (from `?changed=<id>`, how the thread
 * banner hands over a row just answered there) arrives expanded instead of
 * the first. With nothing to show, the board draws nothing and the page's
 * own empty state speaks.
 */
export async function InspectionsBoard({
  locale,
  asked,
  shown,
  userId,
  changed,
}: {
  locale: Locale;
  asked: InspectionList;
  shown: InspectionList;
  userId: string | null;
  changed: string | null;
}) {
  const t = getDictionary(locale);
  const copy = t.inspectionsPage;
  const readFailed = asked.readFailed || shown.readFailed;
  const groups = groupInspections([
    ...tagSide(asked.inspections, "requester"),
    ...tagSide(shown.inspections, "lister"),
  ]);
  const all = [...groups.open, ...groups.closed];
  if (!readFailed && all.length === 0) return null;

  const [facts, reports, quotes, truthAnswered, tenancyDue, shares, rentGate, noShows] = await Promise.all([
    readListingFacts(
      all.map((row) => row.listingId),
      locale,
    ),
    readReportsFor(all.map((row) => row.id)),
    /* V-13: the quote line agreed at the gate. */
    readQuoteLinesFor(
      all.map((row) => row.id),
      locale,
    ),
    readTruthAnsweredFor(all.filter((row) => row.side === "requester").map((row) => row.id)),
    /* V-59: the tenancy review, when one is due. */
    readTenancyReviewsDue(all.filter((row) => row.side === "requester").map((row) => row.id)),
    readMyLiveSafetyShares(),
    /* Track A: the photos a rental report needs, and the agreement it led to. */
    readRentGateFor(all.map((row) => row.id)),
    /* Who reported a no-show, and where its dispute stands. */
    readNoShowsFor(all.filter((row) => row.state === "NO_SHOW").map((row) => row.id)),
  ]);
  /* V-62: every inspection of the renter's with a share still live, whatever
     its state now, so "I'm done" and "Stop sharing" stay while the contact's
     page is up; and the confirmed ones a link can be made for. */
  const goingAlone = safetyControlRows(all, shares, requestNow());
  const tenancyFor = (row: (typeof all)[number]) => {
    const href = tenancyDue.get(row.id);
    return href ? { href, label: t.trustVisible.tenancy.entry } : null;
  };
  /* V-05: the truth questions are open for the requester once the agreed
     time has passed; decided here, once, with the server's clock. */
  const truthFor = (row: (typeof all)[number]) =>
    truthOpenNow(row.side, row.state, row.slotAt, row.requestedAt) || truthAnswered.has(row.id)
      ? { answeredAt: truthAnswered.get(row.id) ?? null, copy: t.trustVisible.truth }
      : null;
  const reportLive = reportStorageLive();
  const expanded = changed ?? groups.open[0]?.id ?? null;

  const sheet = (row: (typeof all)[number]) => (
    <div key={row.id} id={`ix-${row.id}`} className="scroll-mt-16">
      <InspectionSheet
        viewingCopy={t.threads.rental}
        flowCopy={t.memberFlows.inspection}
        success={t.success}
        gateCopy={t.platform.gate}
        dayKit={t.memberKit.dayKit}
        inspection={row}
        side={row.side}
        facts={facts.get(row.listingId) ?? null}
        report={reports.get(row.id) ?? null}
        reportLive={reportLive}
        needPhotos={rentGate.needPhotos}
        agreement={rentGate.agreements.get(row.id) ?? null}
        quoteLine={quotes.get(row.id) ?? null}
        noShow={noShows.get(row.id) ?? null}
        truth={truthFor(row)}
        tenancyReview={tenancyFor(row)}
        unsafe={t.trustVisible.unsafe}
        locale={locale}
        open={row.id === expanded}
      />
    </div>
  );

  return (
    <section
      id="inspections"
      aria-label={copy.title}
      className="scroll-mt-16"
      data-testid="plans-inspections"
    >
      <InspectionsLive userId={userId} />
      {readFailed ? (
        <p className={`mt-row ${TYPE.body}`} role="status">
          {copy.readFailed}
        </p>
      ) : (
        <Reveal>
          <Stack>
            {goingAlone.length > 0 && (
              <Section title={t.trustDoors.safetyShare.stripTitle}>
                <div className="grid gap-sm" data-testid="safety-strip">
                  {goingAlone.map(({ row, initial }) => (
                    <SafetyShareControl
                      key={row.id}
                      inspectionId={row.id}
                      title={row.listingTitle}
                      slotAt={row.slotAt ?? row.requestedAt}
                      locale={locale}
                      copy={t.trustDoors.safetyShare}
                      initial={initial}
                    />
                  ))}
                </div>
              </Section>
            )}
            {groups.open.length > 0 && (
              <Section title={copy.openTitle} description={copy.openDescription}>
                <div className="nf-ix-list">{groups.open.map(sheet)}</div>
              </Section>
            )}
            {groups.closed.length > 0 && (
              <Section title={copy.closedTitle} divided={groups.open.length > 0}>
                <div className="nf-ix-list">{groups.closed.map(sheet)}</div>
              </Section>
            )}
          </Stack>
        </Reveal>
      )}
    </section>
  );
}
