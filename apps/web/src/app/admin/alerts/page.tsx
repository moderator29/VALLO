import type { Metadata } from "next";
import { countOf, getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { getInventoryDriftAlerts, getRiskAlerts } from "@/lib/admin/queries";
import { adminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import {
  queueNoMatch,
  QueueFilters,
  QueuePager,
  queueNarrowed,
  readQueueQuery,
} from "../_components/QueueFilters";
import { AlertCard, alertStatusFilters, DriftCard, driftSectionCopy } from "./AlertCards";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getLocale());
  return { title: t.admin.alerts.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * Risk alerts: the cases that outlive a single flag.
 *
 * An escalated message flag opens one, and anything else the platform judges
 * worth a human look lands here too. An alert stays open until somebody says
 * what was done about it, which is why resolving asks for a note. The cards
 * are in `AlertCards.tsx`, shared with the preview harness so what is
 * screenshotted is what the desk draws.
 */
export default async function AdminAlertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const copy = t.admin.alerts;
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  /* The shared queue frame. This page read the newest fifty alerts and printed
     all of them, so the fifty-first did not exist for an operator and there was
     no way to ask for the open ones from a particular week. */
  const params = await searchParams;
  const query = readQueueQuery(params);
  const [alerts, drift] = await Promise.all([
    getRiskAlerts({
      ...(query.q ? { q: query.q } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.offset ? { offset: query.offset } : {}),
    }),
    getInventoryDriftAlerts(),
  ]);

  if (alerts.state !== "ok") {
    return (
      <div className="nf-console">
        <PageHead title={copy.title} lede={copy.lede} />
        <ui.QueueUnavailable />
      </div>
    );
  }

  const rows = alerts.data.rows;
  const open = rows.filter((alert) => alert.status === "open");
  const resolved = rows.filter((alert) => alert.status !== "open");
  /* A page past the first counts as narrowed for the empty copy. Landing on
     page three of a queue that has run out is a RESULT; "nothing has ever
     arrived here" would be a flat lie told to somebody looking at rows they
     have just paged past. `queueNarrowed` itself deliberately ignores the
     offset, because the Clear control is about the filters. */
  const narrowed = queueNarrowed(query) || (query.offset ?? 0) > 0;
  const noMatch = queueNoMatch(common);

  return (
    <div className="nf-console">
      <PageHead title={copy.title} lede={copy.lede} trail={<ui.WaitingBadge count={open.length} />} />

      {/*
        INVENTORY DRIFT, FIRST AND WHATEVER THE QUEUE IS NARROWED TO.

        The nightly sweep files a row here for every room-night the calendar
        and the bookings disagree about. It is the one alert kind that gets
        worse by the hour, because every hour it sits another guest can book
        a night that is not there, so it is surfaced above the general queue
        with the ids the sweep wrote and the same resolve control, which
        writes the audit log. Resolving says a person looked; it does not
        move inventory, and the copy says so.
      */}
      {drift.state !== "ok" ? (
        <ui.Section
          title="Inventory drift"
          hint="The nightly sweep's findings could not be read just now. The general queue below may still hold them."
        >
          <ui.QueueUnavailable />
        </ui.Section>
      ) : drift.data.open.length > 0 ? (
        <ui.Section {...driftSectionCopy(drift.data.open.length)}>
          <ul className="nf-queue-list">
            {drift.data.open.map((alert) => (
              <DriftCard key={alert.id} alert={alert} copy={copy} common={common} ui={ui} />
            ))}
          </ul>
        </ui.Section>
      ) : (
        <p className="nf-caption mb-block">
          No inventory drift is open.
          {drift.data.resolvedCount > 0
            ? ` ${countOf(drift.data.resolvedCount, "findingsResolved")} been resolved before.`
            : " The nightly sweep files a finding here the first time the calendar and the bookings disagree."}
        </p>
      )}

      <QueueFilters
        base="/admin/alerts"
        query={query}
        common={common}
        statuses={alertStatusFilters(ui)}
      />

      {rows.length === 0 ? (
        <ui.QueueEmpty
          title={narrowed ? noMatch.title : copy.emptyTitle}
          body={narrowed ? noMatch.body : copy.emptyBody}
          state={narrowed ? "no-match" : "never"}
        />
      ) : (
        <>
          {open.length > 0 && (
            <ul className="nf-queue-list">
              {open.map((alert) => (
                <AlertCard key={alert.id} alert={alert} copy={copy} common={common} ui={ui} />
              ))}
            </ul>
          )}

          {resolved.length > 0 && (
            <section className="mt-xl">
              <h2 className="nf-h3 mb-sm text-[length:var(--nf-text-body)]">{common.recentlyResolved}</h2>
              <ul className="nf-queue-list">
                {resolved.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} copy={copy} common={common} ui={ui} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <QueuePager
        base="/admin/alerts"
        query={query}
        pageSize={QUEUE_PAGE_SIZE}
        full={alerts.data.full}
        count={rows.length}
      />
    </div>
  );
}
