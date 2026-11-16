import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { StatusPill } from "@/components/ui/StatusPill";
import { QueueFilters } from "@/app/admin/_components/QueueFilters";
import { adminUi } from "@/app/admin/_components/ui";
import { PageHead } from "@/app/admin/_components/panels";
import {
  ConsoleFooter,
  QueueTable,
  QueueTabs,
} from "@/app/admin/_components/QueueTable";
import { FlagsDesk } from "@/app/admin/_lanes/FlagsLane";
import type { FlagView } from "@/lib/admin/queries";
import { AdminPreviewFrame, PREVIEW_COUNTS } from "../AdminPreviewFrame";
import { ADMIN_ROWS } from "../fixtures";

/**
 * 278CC66A at 390px and CDA4B82B at desktop: the console frame around the
 * queue, from fixture rows. The real layout gates on `requireAdmin`, so the
 * chrome is repeated here from the same pieces; the rows are fixtures.
 *
 *   ?tab=flags     the Message flags tab, drawn by the real `FlagsDesk`
 *   ?empty=1       the same tab, or the whole queue, with nothing waiting
 *
 * Every flag below is invented: the digits are masked and no conversation
 * is real.
 */
export const dynamic = "force-dynamic";

const COUNTS = PREVIEW_COUNTS;

const ago = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

function flag(i: number, reason: FlagView["reason"], matched: string, status: FlagView["status"], hours: number, body: string): FlagView {
  return {
    id: `${["885e4d", "3a91c2", "c07b1f", "5d2e88", "9f4a60"][i - 1]}00-0000-4000-8000-00000000f${String(i).padStart(3, "0")}`,
    reason,
    matched,
    status,
    createdAt: ago(hours),
    messageId: `m-${i}`,
    conversationId: `c-${i}`,
    senderRole: i % 2 === 0 ? "agent" : "guest",
    body,
    context: [
      { id: `l-${i}-1`, role: "guest", body: "Is the flat still free from the first of the month?", createdAt: ago(hours + 1), flagged: false },
      { id: `l-${i}-2`, role: i % 2 === 0 ? "agent" : "guest", body, createdAt: ago(hours), flagged: true },
    ],
  };
}

const FLAGS: FlagView[] = [
  flag(1, "account_number", "01•••••789", "open", 2, "Pay the deposit to 01•••••789 and I will hold it for you."),
  flag(2, "payment_keyword", "bank transfer", "open", 5, "We can do the rest by bank transfer outside the app."),
  flag(3, "account_number", "30•••••112", "open", 9, "Send it to 30•••••112, same name as on my profile."),
  flag(4, "payment_keyword", "pay cash", "open", 20, "You can pay cash when you come for the viewing."),
  flag(5, "account_number", "22•••••450", "reviewed", 40, "My account is 22•••••450 if that is easier."),
];

export default async function PreviewAdminQueue({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const desk = t.platform.queueDesk;
  const empty = sp.empty === "1";
  const flagsTab = sp.tab === "flags";
  const total = empty ? 0 : 42;
  const statuses = [
    { value: "PENDING", label: "Pending" },
    { value: "UNDER_REVIEW", label: "In review" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
  ];
  const tabs = [
    { key: "all", label: "All", href: "/preview/f5/admin-queue", count: total },
    { key: "listings", label: "Listings", href: "#", count: COUNTS.listings },
    { key: "applications", label: "Agents", href: "#", count: COUNTS.applications },
    { key: "reports", label: "Reports", href: "#", count: COUNTS.reports },
    { key: "tickets", label: "Support", href: "#", count: COUNTS.tickets },
    { key: "flags", label: "Flags", href: "/preview/f5/admin-queue?tab=flags", count: empty ? 0 : 4 },
    { key: "held", label: "Held", href: "#", count: COUNTS.moderation },
  ].map((tab) => ({ ...tab, on: tab.key === (flagsTab ? "flags" : "all") }));
  const lanes = {
    label: desk.lanesLabel,
    options: (["all", "late", "mine", "free"] as const).map((key) => ({
      key,
      label: desk.lanes[key],
      href: "#",
      on: key === "all",
    })),
  };

  if (flagsTab) {
    return (
      <AdminPreviewFrame t={t}>
        <div className="nf-console">
          <QueueTabs label="Queues" tabs={tabs} />
        </div>
        <FlagsDesk rows={empty ? [] : FLAGS} full={false} query={{}} locale={locale} lanes={lanes} />
        <ConsoleFooter note={t.admin.console.auditNote} />
      </AdminPreviewFrame>
    );
  }

  /* The live page's row furniture: the select box and the clock line. */
  const rows = empty
    ? []
    : ADMIN_ROWS.map((row, i) => ({
        ...row,
        lead: (
          <label className="mr-2xs inline-flex size-11 shrink-0 cursor-pointer items-center justify-center">
            <input type="checkbox" aria-label={desk.select.replace("{ref}", row.reference)} className="size-4" />
          </label>
        ),
        ...(i % 3 === 0
          ? {
              extra: (
                <span className="nf-admin-row__sub flex flex-wrap items-center gap-2xs">
                  <StatusPill tone="warning" size="xs">
                    {desk.dueIn.replace("{hours}", String(3 + i))}
                  </StatusPill>
                </span>
              ),
            }
          : {}),
      }));

  return (
    <AdminPreviewFrame t={t}>
          <div className="nf-console">
            <PageHead
              title={t.admin.overview.queueTitle}
              lede={t.admin.overview.queueLede}
              trail={<ui.WaitingBadge count={total} />}
            />
            <QueueTabs label="Queues" tabs={tabs} />
            <QueueFilters base="/preview/f5/admin-queue" query={{}} common={t.admin.common} statuses={statuses} lanes={lanes} />
            {rows.length === 0 ? (
              <ui.QueueEmpty
                title="Nothing waiting across these queues"
                body="A listing submitted, an agent application, a report, a support ticket or a flagged message lands here the moment it arrives."
                state="never"
              />
            ) : (
              <QueueTable rows={rows} label="Admin queue" heads={t.uiCommon.console.table} />
            )}
            {rows.length > 0 && (
              <nav aria-label="Queue pages" className="nf-admin-pager">
                <div className="nf-admin-pager__pages">
                  <span className="nf-admin-pager__page" aria-disabled="true">
                    <UiIcon name="chevron-right" size={16} className="rotate-180" />
                  </span>
                  <span className="nf-admin-pager__page nf-admin-pager__page--on" aria-current="page">1</span>
                  <span className="nf-admin-pager__page">2</span>
                  <span className="nf-admin-pager__page">3</span>
                  <span className="nf-admin-pager__page">
                    <UiIcon name="chevron-right" size={16} />
                  </span>
                </div>
                <p className="nf-admin-pager__count">Showing 1 to 10 of {total}</p>
              </nav>
            )}
          </div>
          <ConsoleFooter note={t.admin.console.auditNote} />
    </AdminPreviewFrame>
  );
}
