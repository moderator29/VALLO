import Link from "next/link";
import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { PageHead, ReadOnlyNote } from "../_components/panels";
import { getAuditActivity, getAuditLog } from "@/lib/admin/audit-queries";
import { QUEUE_PAGE_SIZE } from "@/lib/admin/queue-filter";
import {
  queueNoMatch,
  QueueFilters,
  QueuePager,
  queueHref,
  queueNarrowed,
  readQueueQuery,
} from "../_components/QueueFilters";
import { QueueTabs } from "../_components/QueueTable";
import { adminUi } from "../_components/ui";
import { AUDIT_COPY as COPY, AuditList, auditTabs } from "./AuditList";
import { pickAuditEntityType, pickAuditWho } from "@/lib/admin/audit-filter";
import { AuditCharts } from "./AuditCharts";

export async function generateMetadata(): Promise<Metadata> {
  return { title: COPY.title, robots: { index: false, follow: false } };
}

export const dynamic = "force-dynamic";

/**
 * The audit log, on the console's one queue frame: the header, the
 * target-type tabs, the QueueFilters search and day range, the dense rows
 * from `AuditList`, the pager. The layout above this page has already
 * decided the reader is staff.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const common = t.admin.common;
  const ui = adminUi(t, locale);

  const params = await searchParams;
  const query = readQueueQuery(params);
  /* C7: the trail opens on people; "Everything" carries `?who=all` in the
     base, so the tabs, the filters and the pager all keep it. */
  const whoParam = Array.isArray(params.who) ? params.who[0] : params.who;
  const exactId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test((query.q ?? "").trim());
  const who = pickAuditWho(whoParam, pickAuditEntityType(query.status), exactId);
  const base = who === "all" ? `${COPY.base}?who=all` : COPY.base;
  /*
   * The charts read their own window and are NOT narrowed by `query`. A chart
   * that silently followed the operator's search box would carry a caption
   * saying "actions per day" over a picture of one search's results. Read in
   * parallel with the page, because neither one waits on the other.
   */
  const [log, activity] = await Promise.all([
    getAuditLog(
      {
        ...(query.q ? { q: query.q } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.from ? { from: query.from } : {}),
        ...(query.to ? { to: query.to } : {}),
        ...(query.offset ? { offset: query.offset } : {}),
      },
      { who },
    ),
    getAuditActivity(),
  ]);

  if (log.state !== "ok") {
    return (
      <div className="nf-console">
        <PageHead title={COPY.title} lede={COPY.lede} />
        <ui.QueueUnavailable />
      </div>
    );
  }

  const rows = log.data.rows;
  const narrowed = queueNarrowed(query) || (query.offset ?? 0) > 0;
  const noMatch = queueNoMatch(common);

  return (
    <div className="nf-console">
      <PageHead title={COPY.title} lede={COPY.lede} />
      <div className="mt-inline">
        <ReadOnlyNote locale={locale} />
      </div>
      <p className="nf-caption mt-inline">
        <Link className="text-[var(--nf-content-link)] underline" href={`/admin/audit/export${query.from || query.to ? `?${new URLSearchParams({ ...(query.from ? { from: query.from } : {}), ...(query.to ? { to: query.to } : {}) }).toString()}` : ""}`}>
          Download this period as CSV
        </Link>{" "}
        (the last 30 days unless a date range is set; the download is itself recorded here)
      </p>

      {/*
        The chart words come from the DICTIONARY and not from `AUDIT_COPY`.
        The desk's own vocabulary is English constants by a written decision
        (`AuditList.tsx:16`) because `Dictionary["admin"]` is another scope's
        closed type, and that decision stands for the existing strings. New
        ones do not get to inherit it: these six live in `uiCommon`, the
        namespace opened for exactly this, so the console's first charts are
        not also its next seventeen English literals.
      */}
      {activity.state === "ok" ? (
        <AuditCharts
          activity={activity.data}
          locale={locale}
          copy={{
            perDay: t.uiCommon.charts.actionsPerDay,
            byKind: t.uiCommon.charts.actionsByKind,
            byActor: t.uiCommon.charts.actionsByActor,
            rest: t.uiCommon.charts.everythingElse,
            capped: t.uiCommon.charts.cappedWindow,
            window: t.uiCommon.charts.lastDays,
          }}
        />
      ) : null}

      <QueueTabs
        label="Who wrote it"
        tabs={[
          { key: "people", label: "People", href: queueHref(COPY.base, query, { offset: undefined }), on: who === "people" },
          {
            key: "all",
            label: "Everything, with scheduled jobs",
            href: queueHref(`${COPY.base}?who=all`, query, { offset: undefined }),
            on: who === "all",
          },
        ]}
      />
      {who === "people" ? (
        <p className="nf-caption mt-inline">
          Showing what staff and members did. Clean scheduled runs are counted on the operations desk, and
          anything a job raised is on the alerts desk.
        </p>
      ) : null}

      <QueueTabs label={COPY.tabsLabel} tabs={auditTabs(base, query)} />

      <QueueFilters
        base={base}
        query={query}
        common={common}
        statuses={[]}
        searchLabel={COPY.searchLabel}
        searchPlaceholder={COPY.searchPlaceholder}
      />

      {rows.length === 0 ? (
        <ui.QueueEmpty
          title={narrowed ? noMatch.title : COPY.emptyTitle}
          body={narrowed ? noMatch.body : COPY.emptyBody}
          state={narrowed ? "no-match" : "never"}
        />
      ) : (
        <AuditList rows={rows} ui={ui} base={base} />
      )}

      <QueuePager
        base={base}
        query={query}
        pageSize={QUEUE_PAGE_SIZE}
        full={log.data.full}
        count={rows.length}
      />
    </div>
  );
}
