import Link from "next/link";
import type { AuditRowView } from "@/lib/admin/audit-queries";
import {
  AUDIT_ENTITY_TYPES,
  actionLabel,
  entityTypeIcon,
  entityTypeLabel,
  pickAuditEntityType,
} from "@/lib/admin/audit-filter";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { StatusPill } from "@/components/ui/StatusPill";
import { queueHref, type QueueQuery } from "../_components/QueueFilters";
import { shortRef, type QueueTab } from "../_components/QueueTable";
import type { AdminUi } from "../_components/ui";

/*
 * The desk's own words are English constants, exactly as the money desks'
 * rail labels are: `Dictionary["admin"]` is a closed type owned by another
 * scope, and a fifth private copy of console vocabulary is worse than one
 * honest English string until the next dictionary pass. Named in the report.
 */
export const AUDIT_COPY = {
  title: "Audit log",
  lede: "Every privileged decision and every movement of money, as it was written at the time.",
  emptyTitle: "Nothing has been written yet",
  emptyBody: "The first decision taken in this console, or the first kobo that moves, will appear here.",
  searchLabel: "Search the log",
  searchPlaceholder: "An action like agent.suspend, a payment reference, or a user id",
  system: "Processor or schedule",
  all: "All",
  tabsLabel: "Target types",
  tableLabel: "Audit log",
  action: "Action",
  by: "By",
  target: "Target",
  detail: "Detail",
  view: "View",
  filterByActor: "Everything by this person",
  filterByTarget: "Everything about this target",
  base: "/admin/audit",
} as const;

/**
 * The target types as the console's count tabs (278CC66A's "All (42),
 * Listings (18)" row), each a link that narrows the log by `status`, which
 * is the URL key the QueueFilters frame already reads for a chip. No counts:
 * the reader gives none, and a number nobody read is an invented count.
 *
 * The frame's own status chips were drawn under a "Status:" label, and a
 * ledger row has no status; the tabs row is the honest control for a type.
 */
export function auditTabs(base: string, query: QueueQuery): QueueTab[] {
  const active = pickAuditEntityType(query.status);
  return [
    {
      key: "all",
      label: AUDIT_COPY.all,
      href: queueHref(base, query, { status: undefined, offset: undefined }),
      on: active === null,
    },
    ...AUDIT_ENTITY_TYPES.map((type) => ({
      key: type.value,
      label: type.label,
      href: queueHref(base, query, {
        status: active === type.value ? undefined : type.value,
        offset: undefined,
      }),
      on: active === type.value,
    })),
  ];
}

/**
 * One line of the ledger, on the console's dense row (the classes the shared
 * `QueueTable` draws with, so the desk inherits the frame's tile, grid, pill
 * and View exactly). It is not the shared component itself because that row
 * puts a location pin under every title and hides the stamp on the phone,
 * and a ledger line is about a time and a person, never a place.
 *
 * On the phone: the tile, the action with the time and the actor under it,
 * View. On desktop the stamp, the type word, the target-type pill, the
 * target id and the raw token unfold into their own columns. View opens the
 * fold, which carries the links that narrow the log and the writer's own
 * metadata, so a wall of JSON never pushes the next line off the screen and
 * the page ships no client script for it.
 *
 * NEVER MORE THAN THE ROW HOLDS. The actor is a display name; a null actor
 * is the processor or the clock and is labelled so; the target is its type
 * and its id, and the id is a link that narrows the log rather than a link
 * into the record, because this desk reads decisions and does not open
 * records.
 *
 * A server component with no state, shared by the real desk and by the
 * preview harness so the screenshot is of the same rows the desk draws.
 */
export function AuditRow({ row, ui, base }: { row: AuditRowView; ui: AdminUi; base: string }) {
  const detail = formatDetail(row.metadata);
  const when = ui.when(row.createdAt);
  const typeLabel = entityTypeLabel(row.entityType);
  const actor = row.actorId ? (row.actorName ?? row.actorId) : AUDIT_COPY.system;
  return (
    <li>
      <details className="nf-admin-row">
        <summary>
          <div className="nf-admin-row__grid">
            <span className="nf-admin-row__id nf-numeric">{shortRef("LOG", row.id)}</span>
            <span className="nf-admin-row__type">
              <span className="nf-admin-row__tile" aria-hidden="true">
                <UiIcon name={entityTypeIcon(row.entityType)} size={20} />
              </span>
              <span className="nf-admin-row__type-word">{typeLabel}</span>
              <span className="sr-only">{typeLabel}</span>
            </span>
            <span className="nf-admin-row__title">
              <span className="nf-admin-row__name">{actionLabel(row.action)}</span>
              <span className="nf-admin-row__sub flex-wrap">
                {/* The stamp takes its own line on the phone so the actor is
                    never cut to a letter beside it; desktop has a column. */}
                <time dateTime={row.createdAt} className="basis-full nf-numeric lg:hidden">
                  {when}
                </time>
                <span className="min-w-0 max-w-full truncate">{actor}</span>
              </span>
            </span>
            <span className="nf-admin-row__detail">
              {row.entityId && (
                <span className="block truncate nf-numeric font-semibold text-[var(--nf-content-primary)]">
                  {row.entityId}
                </span>
              )}
              <span className="block truncate">{row.action}</span>
            </span>
            {/* The pill is desktop's: on the phone the tile already says the
                type, and a long label ("Webhook delivery") in an auto column
                would squeeze the action to one letter a line. */}
            <span className="nf-admin-row__status max-lg:hidden">
              <StatusPill tone="neutral" size="xs" outlined mark="dot">
                {typeLabel}
              </StatusPill>
            </span>
            <span className="nf-admin-row__when">{when}</span>
            <span className="nf-admin-row__actions">
              <span className="nf-admin-row__view">{AUDIT_COPY.view}</span>
              <span className="nf-admin-row__kebab" aria-hidden="true">
                <UiIcon name="more" size={20} />
              </span>
            </span>
          </div>
        </summary>

        <div className="nf-admin-row__body">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-sm gap-y-2xs text-[length:var(--nf-text-caption)]">
            <dt className="text-[var(--nf-content-muted)]">{AUDIT_COPY.action}</dt>
            <dd className="nf-numeric break-words">{row.action}</dd>

            <dt className="text-[var(--nf-content-muted)]">{AUDIT_COPY.by}</dt>
            <dd className="break-words">
              {row.actorId ? (
                <Link
                  href={queueHref(base, {}, { q: row.actorId })}
                  title={AUDIT_COPY.filterByActor}
                  className="underline-offset-2 hover:underline"
                >
                  {actor}
                </Link>
              ) : (
                <span>{AUDIT_COPY.system}</span>
              )}
            </dd>

            <dt className="text-[var(--nf-content-muted)]">{AUDIT_COPY.target}</dt>
            <dd className="break-words">
              {typeLabel}
              {row.entityId && (
                <>
                  {" "}
                  <span aria-hidden="true">&middot;</span>{" "}
                  <Link
                    href={queueHref(base, {}, { q: row.entityId })}
                    title={AUDIT_COPY.filterByTarget}
                    className="nf-numeric underline-offset-2 hover:underline"
                  >
                    {row.entityId}
                  </Link>
                </>
              )}
            </dd>
          </dl>

          {detail && (
            <pre className="nf-caption mt-xs overflow-x-auto whitespace-pre-wrap [overflow-wrap:anywhere]">
              {detail}
            </pre>
          )}
        </div>
      </details>
    </li>
  );
}

/** The page's rows, in the console's table. */
export function AuditList({ rows, ui, base }: { rows: readonly AuditRowView[]; ui: AdminUi; base: string }) {
  return (
    <div className="nf-panel nf-panel--flush nf-admin-table" role="region" aria-label={AUDIT_COPY.tableLabel}>
      <div className="nf-admin-table__head" aria-hidden="true">
        <span>ID</span>
        <span>Type</span>
        <span>Action / by</span>
        <span>{AUDIT_COPY.target}</span>
        <span>Type</span>
        <span>When</span>
        <span className="text-right">Action</span>
      </div>
      <ul className="m-0 list-none p-0">
        {rows.map((row) => (
          <AuditRow key={row.id} row={row} ui={ui} base={base} />
        ))}
      </ul>
    </div>
  );
}

/** The writer's bag as readable text, or nothing when the bag is empty. */
export function formatDetail(metadata: AuditRowView["metadata"]): string | null {
  if (metadata === null || metadata === undefined) return null;
  if (typeof metadata === "object" && !Array.isArray(metadata) && Object.keys(metadata).length === 0) {
    return null;
  }
  try {
    return JSON.stringify(metadata, null, 2);
  } catch {
    return null;
  }
}
