import type { Metadata } from "next";
import { getDictionary } from "@vallo/i18n";
import { plural } from "@vallo/i18n/core";

import { getLocale } from "@/lib/locale";
import {
  CASE_MODULES,
  CASE_SEVERITIES,
  CATEGORY_LABEL,
  MODULE_LABEL,
  SEVERITY_LABEL,
  STATUS_LABEL,
  caseFiltersQuery,
  caseNumber,
  readCaseFilters,
  type CaseCategory,
  type CaseFilters,
  type CaseRow,
} from "@/lib/admin/cases/model";
import { readCases } from "@/lib/admin/cases/queries";
import type { StatusTone } from "@/components/ui/StatusPill";

import { PageHead, PanelEmpty, TabRow } from "../_components/panels";
import { QueueTable, type QueueRowData } from "../_components/QueueTable";
import { adminUi } from "../_components/ui";
import { CaseSearch } from "./CaseSearch";
import { DeskRefusal } from "./DeskRefusal";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { casesContext } from "@/lib/admin/copilot/contexts/cases";

export const metadata: Metadata = { title: "Cases", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/**
 * /admin/cases: THE CASE DESK, every module's reports in one queue
 * (Trust and Safety, 8 November 2026). Each row is a case: the reports about
 * one thing gathered together, with its severity, its deadline and who owns
 * it. Escalated first, then new, then by severity and deadline, so the most
 * urgent work is always at the top. What each person sees is decided by the
 * database from their staff scope, never by hiding rows here.
 */
const STATUS_TABS: { key: CaseFilters["status"] | "all"; label: string }[] = [
  { key: "open", label: "Open" },
  { key: "new", label: "New" },
  { key: "escalated", label: "Escalated" },
  { key: "awaiting_info", label: "Awaiting information" },
  { key: "resolved", label: "Resolved" },
  { key: "all", label: "All" },
];

const TONE: Record<string, StatusTone> = {
  new: "info",
  under_review: "brand",
  awaiting_info: "warning",
  escalated: "danger",
  resolved: "success",
  closed: "neutral",
};

const ICON: Record<string, QueueRowData["icon"]> = {
  roommates: "users",
  circle: "circle-people",
  feed: "feed",
  property: "house",
  stays: "building-hotel",
  messages: "chat-bubble",
  account: "user",
  other: "flag",
};

export default async function CasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const filters = readCaseFilters(params);
  const locale = await getLocale();
  const ui = adminUi(getDictionary(locale), locale);
  const read = await readCases(filters);

  if (read.state !== "ok") return <DeskRefusal title="Cases" state={read.state} />;

  const { items, total, next } = read.data;
  const statusKey = filters.status ?? "all";
  const link = (patch: Partial<CaseFilters>) => `/admin/cases${caseFiltersQuery({ ...filters, offset: 0, ...patch })}`;

  const rows: QueueRowData[] = items.map((c: CaseRow) => ({
    id: c.id,
    reference: caseNumber(c.number),
    type: MODULE_LABEL[c.module],
    icon: ICON[c.module] ?? "flag",
    title: c.targetLabel ?? CATEGORY_LABEL[c.category as CaseCategory] ?? c.category,
    sub: [CATEGORY_LABEL[c.category as CaseCategory] ?? c.category, c.subject ? `About ${c.subject.name}` : null, plural(c.reportCount, { one: "{count} report", other: "{count} reports" })]
      .filter(Boolean)
      .join(" · "),
    detail: `${SEVERITY_LABEL[c.severity]} severity`,
    detailSub: c.assignee ? `With ${c.assignee.name}` : "Not assigned",
    status: c.status,
    statusLabel: c.overdue ? `${STATUS_LABEL[c.status]}, overdue` : STATUS_LABEL[c.status],
    tone: c.overdue ? "danger" : TONE[c.status],
    submitted: ui.when(c.createdAt),
    href: `/admin/cases/${c.id}`,
  }));

  return (
    <div className="nf-console flex flex-col gap-xl" data-testid="admin-cases">
      <PageHead
        title="Cases"
        lede="Reports from Roommates, Circle, the feed, properties, stays and messages, gathered into one case per thing reported."
      />
      <TabRow
        label="Case status"
        items={STATUS_TABS.map((t) => ({ key: String(t.key), href: link({ status: t.key === "all" ? null : (t.key as CaseFilters["status"]) }), label: t.label, active: statusKey === t.key }))}
      />
      <div className="flex flex-wrap items-center gap-sm">
        <TabRow
          label="Module"
          items={[{ key: "any", href: link({ module: null }), label: "Every module", active: !filters.module }].concat(
            CASE_MODULES.map((m) => ({ key: m, href: link({ module: m }), label: MODULE_LABEL[m], active: filters.module === m })),
          )}
        />
      </div>
      <div className="flex flex-wrap items-center gap-sm">
        <TabRow
          label="Severity"
          items={[{ key: "any", href: link({ severity: null }), label: "Any severity", active: !filters.severity }].concat(
            CASE_SEVERITIES.map((s) => ({ key: s, href: link({ severity: s }), label: SEVERITY_LABEL[s], active: filters.severity === s })),
          )}
        />
        <TabRow
          label="Owner"
          items={[
            { key: "any", href: link({ assigned: "any" }), label: "Anyone", active: filters.assigned === "any" },
            { key: "me", href: link({ assigned: "me" }), label: "Mine", active: filters.assigned === "me" },
            { key: "none", href: link({ assigned: "none" }), label: "Not assigned", active: filters.assigned === "none" },
            { key: "overdue", href: link({ overdue: !filters.overdue }), label: "Overdue only", active: filters.overdue },
          ]}
        />
      </div>
      <CaseSearch initial={filters.q} base={link({ q: "" })} />

      {rows.length === 0 ? (
        <PanelEmpty
          title={filters.q || filters.module || filters.severity || filters.overdue ? "No cases match" : "Nothing waiting"}
          body={filters.q || filters.module || filters.severity || filters.overdue ? "Try fewer filters." : "Every case here is handled. New reports open cases on their own."}
        />
      ) : (
        <>
          <QueueTable rows={rows} label="Cases" columns={{ detail: "Severity and owner" }} />
          <p className="nf-caption text-[var(--nf-content-secondary)] nf-numeric">
            Showing {filters.offset + 1} to {filters.offset + rows.length} of {total}
            {next !== null ? (
              <>
                {" · "}
                <a className="nf-link" href={link({ offset: next })}>
                  Next page
                </a>
              </>
            ) : null}
          </p>
        </>
      )}
      <DeskCopilot
        scope="trust_safety"
        deskName="Cases"
        context={casesContext({
          total,
          shown: items.length,
          overdueOnPage: items.filter((c) => c.overdue).length,
          statusFilter: STATUS_TABS.find((tab) => tab.key === filters.status)?.label ?? null,
          narrowed: Boolean(filters.q || filters.module || filters.severity || filters.overdue || filters.assigned !== "any"),
        })}
      />
    </div>
  );
}
