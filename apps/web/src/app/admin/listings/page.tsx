import type { Metadata } from "next";
import { readPhotoMatchCounts } from "@/lib/photo-hash/matches-read";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getListingSubmissions } from "@/lib/admin/queries";
import {
  getListingReviewTimes,
  getListingStatusCounts,
  getMandateQueue,
  getQueueRowExtras,
} from "@/lib/admin/reads/listings";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import { adminUi } from "../_components/ui";
import { QueueFilters, queueHref, queueNarrowed, readQueueQuery } from "../_components/QueueFilters";
import { LiveRefresh } from "@/app/admin/_components/LiveRefresh";
import { ListingsQueue } from "./ListingsQueue";
import { MandatesPanel } from "./MandatesPanel";
import { MandateConsent } from "./MandateConsent";
import { MandateDecision } from "./MandateDecision";
import { landlordLineIsOpen, readClosedReasons, readMandateConsents } from "@/lib/landlord/queries";
import { consentLine } from "@/lib/landlord/consent";
import { toQueueRow } from "./rows";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { listingsContext } from "@/lib/admin/copilot/contexts/listings";
import { LISTING_TABS, isDecidedStatus, listingStatusWord, reviewHref } from "./tabs";
import "../_review/review.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.admin.listings.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

const ROLE_WORD = { owner: "Owner", agent: "Agent", firm: "Firm" } as const;

/**
 * Listings: the review queue, C1D98B3C panel 1.
 *
 * WHAT IS LIVE. The rows, the tabs, the search, the date range and the pager,
 * all through `getListingSubmissions`, which pages the waiting bucket forty at
 * a time. A row opens the listing under review at `/admin/listings/[id]`, and
 * carries this page's query with it so that page reads the same slice and
 * knows which listing comes next.
 *
 * THE NUMBERS. Tab counts and the Queue health donut are exact per-status
 * counts (`getListingStatusCounts`, lib/admin/reads/listings.ts); the donut
 * counts real listings only and says how many examples it left out, because an
 * example listing must never pass as real supply. Average review time is the
 * median from the audit log's `listing.review` rows (`getListingReviewTimes`),
 * this week against last. Each row carries the lister's role and, where the
 * listing is an example, an Example tag (`getQueueRowExtras`). None of these is
 * computed from the rows on screen: a count of a page is not a count of a
 * queue.
 *
 * Every listing state has a tab. The render draws five; the founder asked for
 * every state to be covered, so Under review, Live and Suspended are here too.
 * The decided states (Live, Rejected, Suspended) come back as the ten most
 * recent from the read, and the page says so until AR-5 pages them.
 */
export default async function AdminListingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.admin.listings;
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  const query = readQueueQuery(await searchParams);
  const status = LISTING_TABS.some((tab) => tab.status === query.status) ? query.status : undefined;
  const offset = query.offset ?? 0;
  const page = Math.floor(offset / QUEUE_PAGE_SIZE) + 1;

  const [read, counts, times, mandates] = await Promise.all([
    getListingSubmissions({
      ...(query.q ? { q: query.q } : {}),
      ...(status ? { status } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(offset ? { offset } : {}),
    }),
    getListingStatusCounts(),
    getListingReviewTimes(),
    getMandateQueue(),
  ]);
  /* V-31: the principal's consent on every mandate, read beside the queue and
     failing soft. A failed read draws the control with "nothing is sent
     without it", which is the true consequence of not knowing. */
  const mandateRows = mandates.state === "ok" ? [...mandates.data.pending, ...mandates.data.decided] : [];
  const [consents, lineOpen] = await Promise.all([
    readMandateConsents(mandateRows.map((row) => row.id)),
    landlordLineIsOpen(),
  ]);
  /* V-48: a listing closed with a reason is SUSPENDED underneath, and it is
     not a suspension. The count and the Suspended tab's query leave it out
     themselves, so nothing is subtracted or filtered here. */
  const total = (key: string) =>
    counts.state === "ok"
      ? (counts.data.real[key as keyof typeof counts.data.real] ?? 0) +
        (counts.data.examples[key as keyof typeof counts.data.examples] ?? 0)
      : null;
  const allCount =
    counts.state === "ok"
      ? LISTING_TABS.reduce((sum, tab) => sum + (total(tab.status) ?? 0), 0)
      : null;

  const base = "/admin/listings";
  const tabs = [
    {
      key: "all",
      label: "All",
      href: queueHref(base, query, { status: undefined, offset: undefined }),
      on: !status,
      count: allCount,
    },
    ...LISTING_TABS.map((tab) => ({
      key: tab.status,
      label: tab.label,
      href: queueHref(base, query, { status: tab.status, offset: undefined }),
      on: status === tab.status,
      count: total(tab.status),
    })),
  ];
  const hrefFor = (id: string) => reviewHref(id, query);
  const copilot = (
    <DeskCopilot
      scope="listing_approval"
      deskName="Listings"
      context={listingsContext(
        counts.state === "ok"
          ? {
              real: counts.data.real,
              examples: Object.values(counts.data.examples).reduce((sum, n) => sum + n, 0),
              medianMinutesThisWeek: times.state === "ok" ? times.data.thisWeek.medianMinutes : null,
              decisionsThisWeek: times.state === "ok" ? times.data.thisWeek.decisions : 0,
            }
          : null,
      )}
    />
  );

  if (read.state !== "ok") {
    return (
      <>
        <ListingsQueue
          title="Listings"
          sub="Review and manage all submitted listings."
          tabs={tabs}
          rows={[]}
          statusLabel={(status) => listingStatusWord(status, ui.statusLabel)}
          counts={null}
          reviewTimes={null}
          page={page}
          hasNext={false}
          hrefForPage={() => base}
          empty={null}
          unavailable
        />
        {copilot}
      </>
    );
  }

  const { waiting, decided, full } = read.data;
  const decidedTab = Boolean(status && isDecidedStatus(status));
  const closedReasons = await readClosedReasons([...waiting, ...decided].map((listing) => listing.id));
  const main = decidedTab ? decided : waiting;
  const shownDecided = !status && offset === 0 ? decided : [];
  const [extras, photoMatches] = await Promise.all([
    getQueueRowExtras([...main, ...shownDecided].map((listing) => listing.id)),
    /* C8: the duplicate-photo signal on the waiting rows only. */
    decidedTab ? Promise.resolve(new Map<string, number>()) : readPhotoMatchCounts(main.map((listing) => listing.id)),
  ]);
  const rowOf = (listing: (typeof main)[number]) => {
    const row = toQueueRow(listing, copy, locale, hrefFor);
    const extra = extras.state === "ok" ? extras.data.get(listing.id) : undefined;
    return {
      ...row,
      listerRole: extra?.role ? ROLE_WORD[extra.role] : null,
      isExample: extra ? extra.isDemo : null,
      badge: extra?.badge ?? null,
      photoMatches: photoMatches.get(listing.id) ?? null,
      /* V-48: a closed listing reads as closed, never as suspended. */
      status: listing.id in closedReasons ? "CLOSED" : row.status,
    };
  };
  const narrowed = queueNarrowed(query) || offset > 0;

  return (
    <>
      <LiveRefresh seconds={30} />
      <ListingsQueue
        title="Listings"
        sub="Review and manage all submitted listings."
        tabs={tabs}
        filters={
          <>
            <QueueFilters
              base={base}
              query={query}
              common={common}
              searchPlaceholder="Search by title or city"
            />
          </>
        }
        rows={main.map(rowOf)}
        decided={shownDecided.length > 0 ? shownDecided.map(rowOf) : undefined}
        decidedTitle={common.recentlyDecided}
        statusLabel={(status) => (status === "CLOSED" ? t.landlord.close.groupTitle : listingStatusWord(status, ui.statusLabel))}
        counts={counts.state === "ok" ? counts.data.real : null}
        examples={
          counts.state === "ok"
            ? Object.values(counts.data.examples).reduce((sum, n) => sum + n, 0)
            : null
        }
        reviewTimes={times.state === "ok" ? times.data : null}
        mandates={
          <MandatesPanel
            queue={mandates.state === "ok" ? mandates.data : null}
            day={ui.day}
            today={lagosToday()}
            decideFor={(row) => <MandateDecision mandateId={row.id} copy={t.complianceBeneficialOwnership} />}
            consentFor={(row) => {
              /* SCUML item 17: a superseded mandate is history; consent is recorded on the current one. */
              if (row.supersededAt) return null;
              const consent = consents?.get(row.id) ?? null;
              return (
                <MandateConsent
                  mandateId={row.id}
                  hasNumber={consent ? consent.hasNumber : Boolean(row.principalPhone)}
                  initial={consentLine(consent, t.landlord.admin, (iso) => ui.day(iso))}
                  readFailed={consents === null}
                  lineOpen={lineOpen}
                  copy={t.landlord.admin}
                  stoppedLine={
                    consent?.numberStoppedAt
                      ? t.landlord.admin.stoppedBefore.replace("{date}", ui.day(consent.numberStoppedAt))
                      : null
                  }
                />
              );
            }}
          />
        }
        page={decidedTab ? 1 : page}
        hasNext={decidedTab ? false : full}
        hrefForPage={(p) => queueHref(base, query, { offset: (p - 1) * QUEUE_PAGE_SIZE })}
        empty={
          narrowed
            ? { title: common.noMatchTitle, body: common.noMatchBody }
            : {
                title: "Nothing is waiting for review",
                body:
                  times.state === "ok" && times.data.lastDecisionAt
                    ? `The last decision was taken ${ui.when(times.data.lastDecisionAt)}. A new submission appears here the moment a lister sends one.`
                    : "No listing has been decided here yet. A new submission appears here the moment a lister sends one.",
                cause:
                  "Submissions come from the listing wizard, when an owner, an agent or a firm sends a property for review. The live listings today are examples, which are not reviewed here.",
                link: { href: "/admin/examples", label: "See the example listings" },
              }
        }
        capNote={
          decidedTab && main.length >= 10
            ? "These are the ten most recent. This tab cannot page further back until request AR-5 lands. Narrow by title, city or date to reach older ones."
            : null
        }
      />
      {copilot}
    </>
  );
}

/** Today's date in Lagos, YYYY-MM-DD, for a mandate's expiry. */
function lagosToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Lagos" }).format(new Date());
}
