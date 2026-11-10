import Link from "next/link";
import { getDictionary } from "@vallo/i18n";
import { getLocale } from "@/lib/locale";
import { requireAdmin, adminRefusal } from "@/lib/admin/guard";
import { getModerationQueue, type ModerationQueue } from "@/lib/admin/moderation-queries";
import {
  getHeldEvents,
  getModerationSummary,
  type HeldEvent,
} from "@/lib/admin/reads/moderation";
import { adminUi, type AdminUi } from "../_components/ui";
import { PageHead } from "../_components/panels";
import { QueueFilters, readQueueQuery, type QueueQuery } from "../_components/QueueFilters";
import { ageShort } from "../_review/metrics";
import { LiveRefresh } from "@/app/admin/_components/LiveRefresh";
import { HoldDecision } from "./HoldDecision";
import { ModerationDesk, type ModerationRow } from "./ModerationDesk";
import { SafetyHolds, safetyHoldRowsFrom } from "./SafetyHolds";
import "../_review/review.css";

/* V-88: this was the /admin/moderation desk, reports by reason beside what
   the safety scan held. It is the Held lane of the unified queue now
   (`/admin/queue?tab=held`) and lists ONLY what the scan held: posts,
   stories, story comments, bios and events. Reports, and their reason chips,
   live in the Reports lane (`?tab=reports&reason=`), so no report is listed
   twice and the lane's count is what the lane shows (V-88 review). */

/**
 * Moderation, 01F7DFC7 panel 1, and the two queues it is made of.
 *
 * REPORTS are what members filed (`reports`, decided with `ReportDecision`,
 * which calls `resolveReport`). HELD items are what the safety scan stopped
 * before anybody saw them: posts, stories, story comments and bios (decided
 * with `HoldDecision`, which calls `decideHeldItem`; the author is notified by
 * the status triggers and a takedown needs a reason they read word for word).
 * Both are one job, so they are one table here; the tabs split them.
 *
 * THE REASON TABS ARE THE REAL CATEGORIES. The render's Abuse, Fraud, Spam,
 * Sexual content and Impersonation are not categories this platform records;
 * the eight in `reports_category_chk` are, so those are the tabs, each
 * narrowing in the query (`getReportsByCategory`), plus "Held by the scan".
 *
 * EVERY FIGURE IS EXACT: `getModerationSummary` (lib/admin/reads/moderation)
 * counts with head-only exact reads and reads its fourteen-day series whole.
 */
const HELD_CAP = 50;

export async function HeldLane({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  /* The moderation scope opens this lane to staff as well as admins, the same
     door the reports and flags lanes use (Track K). */
  const access = await requireAdmin("moderation");
  const locale = await getLocale();
  const t = getDictionary(locale);
  const ui = adminUi(t, locale);
  const common = t.admin.common;

  if (access.state !== "admin") {
    return (
      <div className="nf-console flex flex-col gap-xl">
        <PageHead title="Moderation" />
        <div className="nf-panel nf-panel--card nf-admin-card p-lg">
          <p className="text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-muted)]">
            {adminRefusal(access)}
          </p>
        </div>
      </div>
    );
  }

  const query = readQueueQuery(params);
  const narrowing = {
    ...(query.q ? { q: query.q } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
  };
  const narrowed = Object.keys(narrowing).length > 0;

  const [summary, held, heldEvents] = await Promise.all([
    getModerationSummary(),
    getModerationQueue(narrowing),
    narrowed ? null : getHeldEvents(),
  ]);

  const now = nowMs();
  const rows: (ModerationRow & { at: string })[] = [
    ...heldRows(held, now),
    ...(heldEvents?.state === "ok" ? heldEvents.data.map((event) => eventRow(event, ui, now)) : []),
  ].sort((a, b) => a.at.localeCompare(b.at));

  const base = "/admin/queue?tab=held";
  const categoryLabel = (key: string) =>
    key === "uncategorised" ? "No reason chosen" : ui.columnLabel("reportCategory", key);

  /* V-63: open safety holds, on the lane that answers the reports behind them. */
  let holds: ReturnType<typeof safetyHoldRowsFrom> | null = null;
  /* Safety holds are decided by admins only: `open_safety_holds`,
     `clear_safety_hold` and `extend_safety_hold` check the admin role on
     auth.uid() in the database, so a staff member is not shown a panel whose
     every button would be refused. */
  const showHolds = access.state === "admin" && !access.isStaff;
  if (showHolds) {
    const { data: holdRows, error: holdError } = await (access.supabase as unknown as {
      rpc(fn: string): Promise<{ data: unknown; error: unknown }>;
    }).rpc("open_safety_holds");
    holds = holdError ? null : safetyHoldRowsFrom(holdRows);
  }

  return (
    <>
      <LiveRefresh seconds={30} />
      {showHolds && <SafetyHolds rows={holds} />}
      <ModerationDesk
        tabs={[
          { key: "held", label: "Held by the scan", href: base, on: true },
          { key: "reports", label: "Reports, by reason", href: "/admin/queue?tab=reports", on: false },
        ]}
        summary={summary.state === "ok" ? summary.data : null}
        categoryLabel={categoryLabel}
        filters={
          <QueueFilters
            base={base}
            query={{ ...query, offset: undefined } as QueueQuery}
            common={common}
            searchLabel="Find held words"
            searchPlaceholder="A phrase that was held"
          />
        }
        rows={rows}
        unavailable={false}
        empty={
          narrowed
            ? { title: common.noMatchTitle, body: common.noMatchBody }
            : {
                title: "Nothing held",
                body: "The safety scan is holding nothing. When it holds a post, story, comment, bio or event it lands here, oldest first.",
                cause:
                  "The safety scan holds words as they are posted, and the author is told they are being checked. Member reports are in the Reports lane.",
                link: { href: "/admin/queue?tab=reports", label: "See the reports" },
              }
        }
        notes={
          <>
            {(held.posts.length >= HELD_CAP ||
              held.stories.length >= HELD_CAP ||
              held.comments.length >= HELD_CAP ||
              held.bios.length >= HELD_CAP) ? (
              <p className="nf-rv-panel__note" role="status">
                A held section has reached fifty rows, which is as many as this screen reads at once.
                There are more waiting than are shown. Narrow by a phrase or a date to reach them.
              </p>
            ) : null}
          </>
        }
        pager={null}
      />
    </>
  );
}

/** Wall-clock time, read once per request, outside render purity rules. */
function nowMs(): number {
  return Date.now();
}

function heldRows(queue: ModerationQueue, now: number): (ModerationRow & { at: string })[] {
  const held = (
    id: string,
    at: string,
    icon: ModerationRow["icon"],
    item: string,
    author: { handle: string | null; label: string | null },
    reason: string | null,
    body: React.ReactNode,
  ): ModerationRow & { at: string } => ({
    id,
    at,
    icon,
    item,
    itemSub: author.handle ? `@${author.handle}` : null,
    reporter: "Safety scan",
    reporterSub: "Automatic",
    reason: reason ? truncate(reason, 60) : "Held by the scan",
    age: ageShort(at, now) ?? "",
    status: "HELD",
    statusLabel: "Held",
    tone: "warning",
    body,
  });

  return [
    ...queue.posts.map((post) =>
      held(
        `post:${post.id}`,
        post.createdAt,
        "feed",
        post.isReply ? "Reply" : "Post",
        post.author,
        post.holdReason,
        <HeldBody
          words={post.body || "This post carries no words, only an attachment."}
          reason={post.holdReason}
          link={{ href: `/post/${post.rootId}`, label: "Open the thread" }}
          decision={<HoldDecision target="post" id={post.id} what="post" />}
          meta={[post.author.label, post.areaName].filter(Boolean).join(", ")}
        />,
      ),
    ),
    ...queue.stories.map((story) =>
      held(
        `story:${story.id}`,
        story.createdAt,
        "document",
        "Story",
        story.author,
        story.holdReason,
        <HeldBody
          words={[story.headline, story.standfirst].filter(Boolean).join("\n\n")}
          reason={story.holdReason}
          link={{ href: `/stories/${story.id}`, label: "Open the story" }}
          decision={<HoldDecision target="story" id={story.id} what="story" />}
          meta={[story.author.label, story.areaName ?? story.placeLabel].filter(Boolean).join(", ")}
        />,
      ),
    ),
    ...queue.comments.map((comment) =>
      held(
        `comment:${comment.id}`,
        comment.createdAt,
        "chat-bubble",
        "Story comment",
        comment.author,
        comment.holdReason,
        <HeldBody
          words={comment.body}
          reason={comment.holdReason}
          link={{ href: `/stories/${comment.storyId}`, label: "Open the story" }}
          decision={<HoldDecision target="comment" id={comment.id} what="comment" />}
          meta={[comment.author.label, comment.storyHeadline].filter(Boolean).join(", ")}
        />,
      ),
    ),
    ...queue.bios.map((bio) =>
      held(
        `bio:${bio.userId}`,
        bio.updatedAt,
        "user",
        "Bio",
        { handle: bio.handle, label: bio.label },
        null,
        <HeldBody
          words={bio.bio || "This bio is empty."}
          reason={null}
          link={{ href: `/u/${bio.handle}`, label: "Open the profile" }}
          decision={<HoldDecision target="bio" id={bio.userId} what="bio" />}
          meta={[bio.label, bio.link ? `Link: ${bio.link}` : null].filter(Boolean).join(", ")}
          note="Taking a bio down empties it. The profile itself stays exactly where it is."
        />,
      ),
    ),
  ];
}

function HeldBody({
  words,
  reason,
  link,
  decision,
  meta,
  note,
}: {
  words: string;
  reason: string | null;
  link: { href: string; label: string };
  decision: React.ReactNode;
  meta: string;
  note?: string;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--nf-space-xs)" }}>
      {meta ? <p className="nf-rv-panel__note">{meta}</p> : null}
      <blockquote
        style={{
          margin: 0,
          paddingLeft: "var(--nf-space-sm)",
          borderLeft: "2px solid var(--nf-border-brand)",
          whiteSpace: "pre-wrap",
          color: "var(--nf-content-primary)",
          fontSize: "var(--nf-text-body-sm)",
        }}
      >
        {words}
      </blockquote>
      {reason ? <p className="nf-rv-msg" style={{ color: "var(--nf-status-pending)" }}>Held because: {reason}</p> : null}
      <p className="nf-rv-panel__note">
        <Link href={link.href} style={{ color: "var(--nf-content-link)" }}>
          {link.label}
        </Link>
      </p>
      {note ? <p className="nf-rv-panel__note">{note}</p> : null}
      {decision}
    </div>
  );
}

/**
 * A held event. It can be read and opened, not decided: `decideHeldItem`
 * has no event target, so the row says so rather than offering a button that would do nothing.
 */
function eventRow(event: HeldEvent, ui: AdminUi, now: number): ModerationRow & { at: string } {
  return {
    id: `event:${event.id}`,
    at: event.createdAt,
    icon: "calendar-booking",
    item: "Event",
    itemSub: truncate(event.title, 40),
    reporter: "Safety scan",
    reporterSub: "Automatic",
    reason: event.holdReason ? truncate(event.holdReason, 60) : "Held by the scan",
    age: ageShort(event.createdAt, now) ?? "",
    status: "HELD",
    statusLabel: "Held",
    tone: "warning",
    body: (
      <div style={{ display: "grid", gap: "var(--nf-space-xs)" }}>
        <p className="nf-rv-panel__note">
          {[event.hostName, event.venue, event.startsAt ? ui.when(event.startsAt) : null].filter(Boolean).join(", ")}
        </p>
        <blockquote
          style={{
            margin: 0,
            paddingLeft: "var(--nf-space-sm)",
            borderLeft: "2px solid var(--nf-border-brand)",
            whiteSpace: "pre-wrap",
            color: "var(--nf-content-primary)",
            fontSize: "var(--nf-text-body-sm)",
          }}
        >
          {[event.title, event.blurb].filter(Boolean).join("\n\n")}
        </blockquote>
        {event.holdReason ? (
          <p className="nf-rv-msg" style={{ color: "var(--nf-status-pending)" }}>
            Held because: {event.holdReason}
          </p>
        ) : null}
        <p className="nf-rv-panel__note">
          There is no decision for a held event yet: releasing or removing one needs an action
          Session A has not written (scope request AR-10).
        </p>
      </div>
    ),
  };
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}...` : text;
}

