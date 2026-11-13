import { formatMoney, getDictionary, type Locale } from "@vallo/i18n";
import { adminUi } from "../_components/ui";
import { PageHead, Panel, PanelEmpty, PanelUnavailable, ReadOnlyNote, TabRow } from "../_components/panels";
import type { StatusTone } from "@/components/ui/StatusPill";
import type { ArrangementFilter, ArrangementOpsRead, ArrangementOpsRow } from "./read";

/**
 * MONEY > PROTECTED PAYMENTS: THE ARRANGEMENT OPERATIONS DESK (BUILD 7.11).
 *
 * Every arrangement with the provider's own words beside Vallo's recorded
 * state, when each was last heard from (the signed webhook, the reconcile),
 * what the last reconcile said, and why a payment is with a person. Staff
 * answer "where is my money?" from here. It is READ-ONLY on purpose: no
 * button on it moves, releases, refunds or edits anything, and the money
 * stays the provider's to report.
 */

const TONE: Record<string, StatusTone> = {
  protected: "brand",
  released: "success",
  refunded: "success",
  requires_review: "warning",
  disputed: "warning",
  unknown: "warning",
  failed: "danger",
  cancelled: "neutral",
};

const COPY = {
  title: "Protected payments",
  lede: "Every arrangement, with the provider's own words beside Vallo's recorded state. Read only: money moves only on the provider's word.",
  total: "Arrangements",
  review: "Need a person",
  reviewHint: "Recorded as requires review",
  tabs: "Filter arrangements",
  all: "All",
  needsReview: "Needs review",
  panel: "Arrangements",
  emptyTitle: "No arrangements yet",
  emptyBody: "The protected rail is switched off, so no arrangement has been opened.",
  emptyReviewTitle: "Nothing needs a person",
  emptyReviewBody: "No arrangement is recorded as requires review.",
  forbiddenTitle: "Finance only",
  forbiddenBody: "This desk is open to admins and to staff holding the finance scope.",
  vallo: "Vallo",
  provider: "Provider said",
  providerRef: "Provider reference",
  webhook: "Last webhook",
  reconcile: "Last reconcile",
  reason: "Review reason",
  paused: "Release paused",
  source: "from",
} as const;

export function ArrangementsDesk({ read, filter, locale }: { read: ArrangementOpsRead; filter: ArrangementFilter; locale: Locale }) {
  const ui = adminUi(getDictionary(locale), locale);
  if (read.state === "forbidden") {
    return (
      <div className="nf-admin-stack">
        <PageHead title={COPY.title} lede={COPY.forbiddenBody} />
        <PanelEmpty title={COPY.forbiddenTitle} body={COPY.forbiddenBody} />
      </div>
    );
  }
  return (
    <div className="nf-admin-stack" data-testid="arrangements-desk">
      <PageHead title={COPY.title} lede={COPY.lede} />
      <ReadOnlyNote locale={locale} />
      {read.state === "ok" ? (
        <ui.StatRow>
          <ui.Stat label={COPY.total} value={String(read.total)} />
          <ui.Stat label={COPY.review} value={String(read.review)} hint={COPY.reviewHint} tone={read.review > 0 ? "warning" : "neutral"} />
        </ui.StatRow>
      ) : null}
      <TabRow
        label={COPY.tabs}
        items={[
          { key: "all", href: "/admin/arrangements", label: COPY.all, active: filter === "all" },
          {
            key: "review",
            href: "/admin/arrangements?show=review",
            label: COPY.needsReview,
            active: filter === "review",
            ...(read.state === "ok" ? { count: read.review } : {}),
          },
        ]}
      />
      <Panel title={COPY.panel} id="arrangements-list" flush={read.state === "ok" && read.rows.length > 0}>
        {read.state !== "ok" ? (
          <PanelUnavailable what={COPY.panel} locale={locale} />
        ) : read.rows.length === 0 ? (
          filter === "review" ? (
            <PanelEmpty title={COPY.emptyReviewTitle} body={COPY.emptyReviewBody} />
          ) : (
            <PanelEmpty title={COPY.emptyTitle} body={COPY.emptyBody} />
          )
        ) : (
          <ul className="nf-rows nf-group" aria-label={COPY.panel}>
            {read.rows.map((row) => (
              <ArrangementRow key={row.id} row={row} locale={locale} when={ui.when} Chip={ui.StatusChip} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function ArrangementRow({
  row,
  locale,
  when,
  Chip,
}: {
  row: ArrangementOpsRow;
  locale: Locale;
  when: (iso: string | null) => string;
  Chip: (props: { status?: string; label?: string; tone?: StatusTone }) => React.ReactNode;
}) {
  const providerWords = [row.providerState, row.providerStatus].filter(Boolean).join(" / ");
  const facts: { label: string; value: string }[] = [
    { label: COPY.provider, value: providerWords || "Not reported" },
    ...(row.providerReference ? [{ label: COPY.providerRef, value: row.providerReference }] : []),
    { label: COPY.webhook, value: when(row.lastWebhookAt) },
    { label: COPY.reconcile, value: row.lastReconcileResult ? `${when(row.lastReconcileAt)}, ${row.lastReconcileResult}` : when(row.lastReconcileAt) },
    ...(row.reviewReason ? [{ label: COPY.reason, value: row.reviewReason }] : []),
    ...(row.releasePausedAt ? [{ label: COPY.paused, value: when(row.releasePausedAt) }] : []),
  ];
  return (
    <li className="nf-row flex-wrap items-start" data-testid="arrangement-row" data-status={row.status}>
      <span className="min-w-[14rem] flex-1 basis-0">
        <span className="nf-body flex flex-wrap items-center gap-xs font-semibold text-content">
          {/* Stays `overflow-wrap: anywhere` on purpose: a reference is one token and must wrap inside its cell (13 November 2026; the gate is app/css/overflow-wrap.test.ts). */}
          <span className="font-mono [overflow-wrap:anywhere]">{row.reference}</span>
          <span className="nf-numeric">{formatMoney(row.amountMinor, locale, "NGN")}</span>
        </span>
        <span className="nf-caption block">
          {row.provider}
          {row.category ? ` · ${row.category}` : ""}
          {row.environment ? ` · ${row.environment}` : ""}
          {" · "}
          {when(row.createdAt)}
        </span>
        <dl className="mt-xs grid gap-2xs">
          {facts.map((f) => (
            <div key={f.label} className="flex flex-wrap gap-x-xs">
              <dt className="nf-caption text-content-secondary">{f.label}</dt>
              <dd className="nf-caption m-0 text-content break-words">{f.value}</dd>
            </div>
          ))}
        </dl>
      </span>
      <span className="flex flex-col items-end gap-2xs">
        <span className="nf-caption">{COPY.vallo}</span>
        <Chip status={row.status} label={row.status.replace(/_/g, " ")} tone={TONE[row.status] ?? "info"} />
        {row.statusSource ? (
          <span className="nf-caption">
            {COPY.source} {row.statusSource.replace(/_/g, " ")}, {when(row.statusObservedAt)}
          </span>
        ) : null}
      </span>
    </li>
  );
}
