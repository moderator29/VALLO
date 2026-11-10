import type { Metadata } from "next";

import { CopyButton } from "@/components/docs/CopyButton";
import { UnderlineTabs } from "@/components/ui/UnderlineTabs";
import { DeskCopilot } from "@/lib/admin/copilot/contexts/DeskCopilot";
import { contentContext } from "@/lib/admin/copilot/contexts/content";
import {
  KIND_LABEL,
  STATUS_LABEL,
  calendarWeeks,
  contentHealth,
  daysLate,
  isOverdue,
  shiftMonth,
  type ContentItem,
} from "@/lib/admin/content/model";
import { readContentItems, readFeedModeration, type FeedModeration } from "@/lib/admin/content/queries";
import { deskDoor } from "@/lib/admin/desk-door";
import { countEntries, entriesOf, entryRef } from "@/lib/admin/desk-entries/model";
import { readEntries, readNames } from "@/lib/admin/desk-entries/queries";
import { lagosToday } from "@/lib/admin/desk-rules";
import { requireAdmin } from "@/lib/admin/guard";
import { readDocFeedback, type DocFeedbackRead } from "@/app/admin/doc-feedback/read";

import { DeskLink, DeskRefused, DeskTable, Source, shortDate } from "../_components/desk-parts";
import { EntryTool } from "../_components/EntryTool";
import { Badge, CalmNote, KpiGrid, NotWired, PageHead, Panel, type BadgeTone, type KpiItem } from "../_components/panels";
import { ApproverActions, ItemForm, MakerActions } from "./ContentControls";

export const metadata: Metadata = { title: "Content", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const TABS = [
  ["items", "Items"],
  ["calendar", "Calendar"],
  ["requests", "Requests"],
  ["style", "Style and SEO"],
  ["translations", "Translations"],
  ["publishing", "Publishing"],
  ["gaps", "Help gaps"],
  ["feed", "Feed"],
] as const;
type Tab = (typeof TABS)[number][0];

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);

const STATUS_TONE: Record<ContentItem["status"], BadgeTone> = { draft: "info", in_review: "pending", approved: "success", published: "success", retired: "info" };

/**
 * THE CONTENT MANAGER'S DESK (founder, 10 November 2026). The editorial items
 * and their approvals, the calendar, requests from other departments, the
 * style guide and SEO checklists, translation status, the publishing
 * checklist, the help gaps read from the Pages-that-fail desk, and the feed
 * moderation counts. Text and links only; media lives in the social media
 * library. A figure that could not be read says so instead of showing zero.
 */
export default async function ContentPage({ searchParams }: { searchParams: Promise<Params> }) {
  const door = await deskDoor("content", { approverMayEnter: true });
  if (door.state !== "ok") return <DeskRefused title="Content" state={door.state} who="This desk is for the Content Manager." />;

  const params = await searchParams;
  const asked = one(params.tab);
  const tab: Tab = door.viaApprover ? "items" : ((TABS.find(([k]) => k === asked)?.[0] ?? "items") as Tab);
  const month = /^\d{4}-\d{2}$/.test(one(params.month) ?? "") ? (one(params.month) as string) : lagosToday().slice(0, 7);

  const [itemsRead, entriesRead, feed, docs, kbRead] = await Promise.all([
    readContentItems(door.db),
    readEntries(door.db, "content"),
    tab === "feed" || tab === "items" ? readFeedModeration(door.db) : Promise.resolve(null),
    tab === "gaps" ? readDocs() : Promise.resolve(null),
    tab === "gaps" ? readEntries(door.db, "support_lead") : Promise.resolve(null),
  ]);
  const notOpen = itemsRead.state === "not-open";
  const items = itemsRead.state === "ok" ? itemsRead.data : [];
  const readable = itemsRead.state === "ok";
  const entries = entriesRead.state === "ok" ? entriesRead.data : [];
  const names = Object.fromEntries(await readNames(door.db, entries.flatMap((e) => [e.approvedBy, e.createdBy])));
  const health = contentHealth(items);
  const entryCounts = countEntries(entries);
  const context = readable
    ? contentContext({
        inReview: health.byStatus.in_review + entryCounts.waitingApproval,
        drafts: health.byStatus.draft,
        overdue: health.overdue,
        dueThisWeek: health.dueThisWeek,
        stuckInReview: health.stuckInReview,
        publishedThisMonth: health.publishedThisMonth,
        openReports: feed?.openReports ?? null,
        openRequests: entriesOf(entries, "content_request").filter((e) => e.status === "open").length,
      })
    : null;
  const canMake = !door.viaApprover;
  const common = { entries, canMake, canApprove: door.canApprove, names, readable: entriesRead.state === "ok" } as const;

  return (
    <div className="nf-console nf-admin-stack">
      <PageHead
        title="Content"
        lede="Guides, announcements and articles through one approval step, the calendar, what other departments have asked for, the style guide, and the help pages members need. Nothing here publishes by itself: you record where it went live."
        action={<DeskLink href="/admin/social-media">Social media desk</DeskLink>}
      />
      {notOpen ? (
        <Panel>
          <NotWired what="The content tables are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_roles_step2_2026-11-10.sql." />
        </Panel>
      ) : itemsRead.state === "error" ? (
        <Panel>
          <CalmNote kind="error" title="The content items could not be read" fills="Nothing was changed. Refresh in a moment." />
        </Panel>
      ) : null}
      {entriesRead.state === "not-open" && !notOpen ? (
        <Panel>
          <NotWired what="The request, checklist and style tables are not on this database yet." request="Ask the lead to apply supabase/migrations/pending/staff_roles_step2_2026-11-10.sql." />
        </Panel>
      ) : null}
      {door.viaApprover ? (
        <Panel>
          <p className="nf-body-sm text-[var(--nf-content-secondary)]">You are here to approve. You can read every item and approve or send one back; the Content Manager makes the changes.</p>
        </Panel>
      ) : (
        <UnderlineTabs label="Content desk" active={tab} items={TABS.map(([key, label]) => ({ key, label, href: key === "items" ? "/admin/content" : `/admin/content?tab=${key}` }))} />
      )}

      {tab === "items" ? <Items items={items} readable={readable} canApprove={door.canApprove} viaApprover={door.viaApprover} health={health} waitingEntries={entryCounts.waitingApproval} /> : null}
      {tab === "calendar" ? <Calendar items={items} month={month} /> : null}
      {tab === "requests" ? <Panel title="Requests from other departments"><EntryTool kind="content_request" {...common} /></Panel> : null}
      {tab === "style" ? (
        <div className="grid gap-lg">
          <Panel title="Style and tone"><EntryTool kind="style_note" {...common} /></Panel>
          <Panel title="SEO checklist, one per article"><EntryTool kind="seo_check" {...common} /></Panel>
        </div>
      ) : null}
      {tab === "translations" ? <Panel title="Translation status: English, Hausa, Yoruba, Igbo"><EntryTool kind="translation" {...common} /></Panel> : null}
      {tab === "publishing" ? (
        <div className="grid gap-lg">
          <Panel title="Publishing checklist"><EntryTool kind="publish_check" {...common} /></Panel>
          <Panel title="Staff announcement drafts"><EntryTool kind="staff_announcement_draft" {...common} /></Panel>
        </div>
      ) : null}
      {tab === "gaps" ? (
        <div className="grid gap-lg">
          <DocsFailing read={docs} />
          <KbGaps entries={kbRead && kbRead.state === "ok" ? kbRead.data.filter((e) => e.kind === "kb_gap" && e.status === "open") : null} />
          <Panel title="Help gaps being worked"><EntryTool kind="docs_gap" {...common} /></Panel>
        </div>
      ) : null}
      {tab === "feed" && feed ? <Feed feed={feed} /> : null}
      <DeskCopilot scope="content" deskName="Content" context={context} />
    </div>
  );
}

async function readDocs(): Promise<DocFeedbackRead> {
  const access = await requireAdmin("content");
  if (access.state !== "admin") return { state: "unavailable" };
  return readDocFeedback(access.userClient);
}

function ItemCard({ item, canApprove, viaApprover }: { item: ContentItem; canApprove: boolean; viaApprover: boolean }) {
  const late = isOverdue(item);
  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-md" data-testid="content-item-card">
      <div className="flex flex-wrap items-center gap-xs">
        <span className="font-semibold text-[var(--nf-content-primary)] [overflow-wrap:anywhere]">{item.title}</span>
        <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
        {late ? <Badge tone="error">{daysLate(item)} days late</Badge> : null}
      </div>
      <p className="nf-caption mt-3xs flex flex-wrap items-center gap-xs text-[var(--nf-content-secondary)]">
        <span>{KIND_LABEL[item.kind]}</span>
        <span>{item.plannedFor ? `Planned ${shortDate(item.plannedFor)}` : "No date yet"}</span>
        <span>{entryRef("content_item", item.id)}</span>
        <CopyButton text={entryRef("content_item", item.id)} label="Reference" />
      </p>
      {item.summary ? <p className="nf-body-sm mt-xs whitespace-pre-wrap">{item.summary}</p> : null}
      {item.status === "draft" && item.reviewNote ? <p className="nf-caption mt-xs" role="note">Sent back: {item.reviewNote}</p> : null}
      {item.linkUrl ? (
        <p className="nf-caption mt-xs flex flex-wrap items-center gap-xs [overflow-wrap:anywhere]">
          <span>Source: {item.linkUrl}</span>
          <CopyButton text={item.linkUrl} label="Link" icon="link" />
        </p>
      ) : null}
      {item.publishedUrl ? (
        <p className="nf-caption mt-xs flex flex-wrap items-center gap-xs [overflow-wrap:anywhere]">
          <a className="font-semibold text-[var(--nf-content-link)] hover:underline" href={item.publishedUrl} target="_blank" rel="noreferrer noopener">{item.publishedUrl}</a>
          <CopyButton text={item.publishedUrl} label="Live link" icon="link" />
        </p>
      ) : null}
      {item.body ? (
        <details className="mt-sm">
          <summary className="nf-body-sm cursor-pointer">Read the text</summary>
          <p className="nf-body-sm mt-xs whitespace-pre-wrap [overflow-wrap:anywhere]">{item.body}</p>
          <div className="mt-xs"><CopyButton text={item.body} label="Text" /></div>
        </details>
      ) : null}
      <div className="mt-sm grid gap-sm">
        {canApprove && item.status === "in_review" ? <ApproverActions item={item} /> : null}
        {!viaApprover ? <MakerActions item={item} /> : null}
      </div>
    </li>
  );
}

function Items({ items, readable, canApprove, viaApprover, health, waitingEntries }: { items: ContentItem[]; readable: boolean; canApprove: boolean; viaApprover: boolean; health: ReturnType<typeof contentHealth>; waitingEntries: number }) {
  const kpi = (key: string, label: string, n: number, caption?: string): KpiItem => ({ key, label, value: readable ? String(n) : null, ...(readable ? { count: n } : {}), ...(caption ? { caption } : {}) });
  const kpis = [
    kpi("draft", "Drafts", health.byStatus.draft, `${health.sentBack} sent back`),
    kpi("review", "Waiting for approval", health.byStatus.in_review + waitingEntries, `${health.stuckInReview} for over a week`),
    kpi("late", "Past their date", health.overdue, `${health.dueThisWeek} due this week`),
    kpi("pub", "Published this month", health.publishedThisMonth),
  ];
  const waiting = items.filter((i) => i.status === "in_review");
  const columns: [string, string, ContentItem["status"][]][] = [
    ["drafts", "Drafts", ["draft"]],
    ["review", "In review and approved", ["in_review", "approved"]],
    ["published", "Published", ["published"]],
  ];
  return (
    <div className="grid gap-lg">
      <KpiGrid items={kpis} label="Content figures" />
      {canApprove && waiting.length > 0 ? (
        <Panel title="Waiting for approval">
          <ul className="grid gap-sm">{waiting.map((i) => <ItemCard key={i.id} item={i} canApprove={canApprove} viaApprover={viaApprover} />)}</ul>
        </Panel>
      ) : null}
      {items.length === 0 && readable ? (
        <Panel><CalmNote title="No items yet" fills="Every guide, announcement and article is written, approved and recorded here." creates={viaApprover ? undefined : "Create the first one below."} /></Panel>
      ) : (
        <div className="grid gap-md lg:grid-cols-3">
          {columns.map(([key, title, statuses]) => {
            const list = items.filter((i) => statuses.includes(i.status) && !(canApprove && i.status === "in_review"));
            return (
              <Panel key={key} title={`${title} (${list.length})`}>
                {list.length === 0 ? <p className="nf-body-sm text-[var(--nf-content-secondary)]">Nothing here.</p> : <ul className="grid gap-sm">{list.map((i) => <ItemCard key={i.id} item={i} canApprove={canApprove} viaApprover={viaApprover} />)}</ul>}
              </Panel>
            );
          })}
        </div>
      )}
      {items.some((i) => i.status === "retired") ? (
        <Panel title="Retired">
          <ul className="grid gap-sm">{items.filter((i) => i.status === "retired").map((i) => <ItemCard key={i.id} item={i} canApprove={false} viaApprover={viaApprover} />)}</ul>
        </Panel>
      ) : null}
      {!viaApprover ? <Panel title="New item"><ItemForm /></Panel> : null}
    </div>
  );
}

function Calendar({ items, month }: { items: ContentItem[]; month: string }) {
  const weeks = calendarWeeks(items, month);
  const unscheduled = items.filter((i) => i.plannedFor === null && i.status !== "published" && i.status !== "retired");
  return (
    <div className="grid gap-lg">
      <Panel title={`Editorial calendar, ${month}`}>
        <div className="mb-sm flex gap-xs">
          <DeskLink href={`/admin/content?tab=calendar&month=${shiftMonth(month, -1)}`}>Earlier month</DeskLink>
          <DeskLink href={`/admin/content?tab=calendar&month=${shiftMonth(month, 1)}`}>Later month</DeskLink>
        </div>
        <ul className="grid gap-sm">
          {weeks.map((w) => (
            <li key={w.start} className="nf-admin-card p-md">
              <p className="nf-caption text-[var(--nf-content-secondary)]">Week {w.label}</p>
              {w.items.length === 0 ? <p className="nf-body-sm">Nothing planned.</p> : (
                <ul className="nf-body-sm grid gap-3xs">
                  {w.items.map((i) => <li key={i.id} className="[overflow-wrap:anywhere]">{shortDate(i.plannedFor)} · {i.title} · {KIND_LABEL[i.kind]} · {STATUS_LABEL[i.status]}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      {unscheduled.length > 0 ? (
        <Panel title={`No date yet (${unscheduled.length})`}>
          <ul className="nf-body-sm grid gap-3xs">{unscheduled.map((i) => <li key={i.id}>{i.title} · {KIND_LABEL[i.kind]}</li>)}</ul>
        </Panel>
      ) : null}
    </div>
  );
}

function DocsFailing({ read }: { read: DocFeedbackRead | null }) {
  return (
    <Panel title="Pages members say did not help" flush>
      {!read || read.state === "unavailable" ? (
        <div className="p-md"><CalmNote kind="error" title="The page feedback could not be read" fills="Nothing is shown rather than a clean list. Refresh in a moment." /></div>
      ) : read.state === "not-switched-on" ? (
        <div className="p-md"><NotWired what="Page feedback is not switched on yet." request="Ask the lead to apply supabase/migrations/pending/docs_page_feedback_2026-11-10.sql." /></div>
      ) : read.rows.length === 0 ? (
        <div className="p-md"><p className="nf-body-sm">No page has been marked unhelpful in the last 30 days.</p></div>
      ) : (
        <DeskTable
          caption="Pages ranked by answers saying they did not help, last 30 days"
          columns={[{ key: "page", label: "Page" }, { key: "no", label: "Did not help", numeric: true }, { key: "yes", label: "Helped", numeric: true }, { key: "copy", label: "" }]}
          rows={read.rows.slice(0, 15).map((r) => ({ key: r.page, cells: { page: r.page, no: String(r.notHelpful), yes: String(r.helpful), copy: <CopyButton text={r.page} label="Page" icon="link" /> } }))}
        />
      )}
    </Panel>
  );
}

function KbGaps({ entries }: { entries: { id: string; title: string; fields: Record<string, string> }[] | null }) {
  return (
    <Panel title="Questions support keeps answering">
      {entries === null ? (
        <p className="nf-body-sm">The support lead&apos;s list could not be read just now.</p>
      ) : entries.length === 0 ? (
        <p className="nf-body-sm">The Customer Support Lead has no open knowledge-base gaps.</p>
      ) : (
        <ul className="nf-body-sm grid gap-3xs">{entries.map((e) => <li key={e.id} className="[overflow-wrap:anywhere]">{e.title}{e.fields.seen ? ` (${e.fields.seen})` : ""}</li>)}</ul>
      )}
      <Source>Read only. The Customer Support Lead keeps this list; once an answer is published they mark it answered.</Source>
    </Panel>
  );
}

function Feed({ feed }: { feed: FeedModeration }) {
  const rows: [string, number | null][] = [
    ["Open reports on the feed", feed.openReports],
    ["Posts held for review", feed.heldPosts],
    ["Stories held for review", feed.heldStories],
    ["Story comments held for review", feed.heldComments],
    ["Open feed cases", feed.openFeedCases],
    ["Open Circle cases", feed.openCircleCases],
  ];
  return (
    <Panel title="Feed moderation, counts only">
      <ul className="nf-body-sm grid gap-3xs">
        {rows.map(([label, n]) => (
          <li key={label}>{label}: {n === null ? "Not available" : n}</li>
        ))}
      </ul>
      <Source>{rows.some(([, n]) => n === null) ? "A figure marked Not available could not be read just now. " : ""}You see counts only. The decisions, the posts and the people stay with moderation: raise anything unusual with the Head of Trust and Safety.</Source>
    </Panel>
  );
}
