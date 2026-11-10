import type { Metadata } from "next";
import { countOf, formatMoney, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getExamplesConsole, isOverdue, lagosToday } from "@/lib/admin/examples-queries";
import { adminUi, type AdminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import {
  QueueFilters,
  QueuePager,
  queueNarrowed,
  readQueueQuery,
  type QueueStatusOption,
} from "../_components/QueueFilters";
import { Constants } from "@/lib/supabase/database.types";
import type { ExampleListingView } from "@/lib/admin/examples-queries";
import { RetireExamples } from "./RetireExamples";

export const metadata: Metadata = {
  title: "Examples",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * The example listings, as a set.
 *
 * WHY THIS IS ITS OWN SCREEN. Forty-two seeded properties carry `is_demo` so
 * the catalogue is not empty while the product fills up. `/admin/listings` is a
 * review queue keyed on status, so those forty-two sit inside it looking
 * exactly like real supply, and the word "demo" did not appear anywhere in the
 * admin tree. Two things follow from that, and both are bad: an operator
 * reading the queue cannot tell seeded stock from a real lister's property, and
 * on the day real supply arrives there is no way to take the seeded set off the
 * catalogue short of running SQL.
 *
 * The count at the top is the honest measure of how much of the catalogue is
 * still furniture, which is a number the owner should be able to watch fall.
 */
/** The chips, from `listing_status`, because an example is a listing. */
function statusFilters(ui: AdminUi): readonly QueueStatusOption[] {
  return Constants.public.Enums.listing_status.map((value) => ({
    value,
    label: ui.statusLabel(value),
  }));
}

export default async function AdminExamplesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  /* The shared queue frame. The tiles above are deliberately not narrowed by
     it: see the note on `getExamplesConsole`. */
  const params = await searchParams;
  const query = readQueueQuery(params);
  const narrowed = queueNarrowed(query) || (query.offset ?? 0) > 0;
  const read = await getExamplesConsole({
    ...(query.q ? { q: query.q } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.offset ? { offset: query.offset } : {}),
  });

  if (read.state !== "ok") {
    return (
      <div className="nf-console">
        <PageHead
          title="Examples"
          lede="The seeded properties that keep the catalogue from looking empty."
        />
        <ui.QueueUnavailable />
      </div>
    );
  }

  const { live, retired, totals } = read.data;
  const today = lagosToday();

  return (
    <div className="nf-console">
      <PageHead
        title="Examples"
        lede="The seeded properties that keep the catalogue from looking empty while real supply arrives. They are marked in the database, they can never be booked against, and every one of them carries the day it is due to come down."
        trail={<ui.WaitingBadge count={totals.overdueCount} />}
      />

      <ui.StatRow>
        <ui.Stat
          label="On the catalogue"
          value={String(totals.liveCount)}
          hint={
            totals.liveCount === 0
              ? "The catalogue is all real supply"
              : `Across ${countOf(totals.cities, "cities")}`
          }
          tone={totals.liveCount === 0 ? "success" : "warning"}
        />
        <ui.Stat
          label="Past their date"
          value={String(totals.overdueCount)}
          hint={
            totals.overdueCount === 0
              ? totals.nextDueOn
                ? `Next due ${ui.day(totals.nextDueOn)}`
                : "Nothing is due"
              : "These were meant to be gone"
          }
          tone={totals.overdueCount === 0 ? "success" : "danger"}
        />
        <ui.Stat
          label="Retired"
          value={String(totals.retiredCount)}
          hint="Off the catalogue, rows kept"
        />
      </ui.StatRow>

      {totals.overdueCount > 0 && (
        <ui.QueueAlarm
          title={`${countOf(totals.overdueCount, "examplesAre")} past the day they were due out`}
          body="The retirement date is a decision that was recorded on each row, and it has passed. Nothing hides these automatically, on purpose: a catalogue that empties itself overnight would take search and the map down with it and give nobody a reason why."
        />
      )}

      <QueueFilters
        base="/admin/examples"
        query={query}
        common={common}
        statuses={statusFilters(ui)}
        searchPlaceholder="Search by title or city"
      />

      {narrowed && live.length === 0 && retired.length === 0 && (
        /* A SEARCH THAT MATCHED NOTHING IS NOT A CLEARANCE. This drew the
           emerald tick, so "all clear" was shown over a queue that may hold
           hundreds of rows, none of them matching. The third state says what
           this actually is: the result of the operator's own filter. */
        <ui.QueueEmpty
          title={common.noMatchTitle}
          body={common.noMatchBody}
          state="no-match"
        />
      )}

      <ui.Section
        title="Still on the catalogue"
        hint="Visible to the public in search and on the map."
      >
        {live.length === 0 ? (
          /* Narrowed, this section says nothing: "no example is public any
             more" is a claim about the whole catalogue and is false to somebody
             who has just filtered to one city. */
          narrowed ? null : (
            /* "No example is public ANY MORE" is a claim about the past: it
               says there were some and they were retired. `retired` is that
               claim's evidence. With neither list holding a row, no example
               was ever published and the tick would be celebrating a clean-up
               nobody did. F2-056. */
            <ui.QueueEmpty
              title="No example is public any more"
              body="Everything a visitor can see is a real listing from a real lister."
              everHadRows={retired.length > 0}
            />
          )
        ) : (
          <div className="nf-panel nf-panel--card nf-admin-card">
            <ul className="nf-rows nf-group">
              {live.map((listing) => (
                <ExampleRow
                  key={listing.id}
                  listing={listing}
                  ui={ui}
                  locale={locale}
                  today={today}
                />
              ))}
            </ul>
          </div>
        )}
      </ui.Section>

      <ui.Section title="Retiring them">
        <RetireExamples live={live} />
      </ui.Section>

      {retired.length > 0 && (
        <ui.Section
          title="Already retired"
          hint="Suspended rather than deleted, so any of them can come back if the catalogue thins out."
        >
          <div className="nf-panel nf-panel--card nf-admin-card">
            <ul className="nf-rows nf-group">
              {retired.map((listing) => (
                <ExampleRow
                  key={listing.id}
                  listing={listing}
                  ui={ui}
                  locale={locale}
                  today={today}
                />
              ))}
            </ul>
          </div>
        </ui.Section>
      )}

      <QueuePager
        base="/admin/examples"
        query={query}
        pageSize={QUEUE_PAGE_SIZE}
        full={read.data.full}
        count={live.length + retired.length}
      />
    </div>
  );
}

function ExampleRow({
  listing,
  ui,
  locale,
  today,
}: {
  listing: ExampleListingView;
  ui: AdminUi;
  locale: Awaited<ReturnType<typeof getLocale>>;
  today: string;
}) {
  /* Only a live example can be overdue. A retired one has already gone, so
     printing "past its date" beside it would be describing a solved problem. */
  const overdue = !listing.retired && isOverdue(listing.retireAfter, today);

  /* THE ROW WRAPS RATHER THAN PUSHING THE FIGURE OFF THE PHONE. A status chip,
     the words, a second chip and the amount on one line overflowed 390px in
     Igbo, where the chip labels run longest (C1 sweep, measured): the words
     keep at least 12rem beside the first chip, and what does not fit drops to
     a second line with the amount at its end. */
  return (
    <li className="nf-row flex-wrap">
      <ui.StatusChip status={listing.status} />
      <span className="min-w-[12rem] flex-1 basis-0">
        <span className="nf-body block font-semibold text-content">{listing.title}</span>
        <span className="nf-caption block truncate">
          {listing.city ?? "City not recorded"} · {listing.listerName ?? "Lister not on file"}
          {listing.retireAfter && ` · due out ${ui.day(listing.retireAfter)}`}
        </span>
      </span>
      {overdue && <ui.StatusChip label="Past its date" tone="danger" />}
      {listing.amountMinor !== null && (
        <span className="nf-numeric nf-body ml-auto shrink-0 font-semibold">
          {formatMoney(listing.amountMinor, locale)}
        </span>
      )}
    </li>
  );
}
