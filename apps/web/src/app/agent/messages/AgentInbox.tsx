import Link from "next/link";
import type { AgentInbox as Inbox, AgentThread } from "@/lib/agent/messages-queries";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { countByStage, STAGES, type DeskStage, type Stage } from "@/lib/enquiry/stage";
import { countOf, type Dictionary } from "@vallo/i18n/core";
import { IconPlate } from "@/components/ui/IconPlate";

/**
 * The host inbox.
 *
 * A server component: the filter travels in the address bar rather than in
 * client state, so this surface holds none of its own and a filtered inbox is a
 * link an agent can bookmark or send to a colleague.
 *
 * The ordering is the opinion here. A host does not want their enquiries newest
 * first, they want the one that has been waiting longest on them, because that
 * is the one costing them a booking.
 */

export type InboxFilter = "waiting" | "all" | "due";

/** AGENT-01: the words of the Due today filter and its empty state. */
export type DueCopy = { chip: string; empty: string; emptyBody: string };

function waitLabel(hours: number): string {
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.floor(hours / 24);
  return countOf(days, "daysWaiting");
}

type DeskCopy = Dictionary["frontDoor"]["desk"];

function stageWords(stage: DeskStage, copy: DeskCopy): string {
  return stage.stage === "lost" && stage.lostReason
    ? copy.lostWithReason.replace("{reason}", copy.reasons[stage.lostReason])
    : copy.stages[stage.stage];
}

function ThreadRow({
  thread,
  askedLabel,
  stage,
  deskCopy,
  missedWords,
}: {
  /** VC1: "Missed video call" and "Missed voice call", from the page's dictionary. */
  missedWords?: { VIDEO: string; AUDIO: string } | undefined;
  thread: AgentThread;
  askedLabel?: string | undefined;
  stage?: DeskStage | undefined;
  deskCopy?: DeskCopy | undefined;
}) {
  return (
    <li>
      <Link
        /* Inside the workspace: the same thread screen under the agent shell,
           so a phone keeps the workspace drawer (app/agent/messages/[id]). */
        href={`/agent/messages/${thread.id}`}
        /* `.nf-card` paints its border from a conic brand gradient through a
           transparent border-color, so setting `border-color` on hover threw
           the gradient away and left a flat 22 per cent white outline, which
           is the dull container the founder photographed. `.nf-card--interactive`
           is the designed answer: the press physics, and the light travelling
           once round the ring on a pointer. */
        className="nf-panel nf-panel--card nf-card--interactive block p-md"
      >
        <div className="flex items-start justify-between gap-sm">
          <div className="min-w-0 leading-tight">
            <p className="truncate text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
              {thread.counterpartName}
            </p>
            {thread.listingTitle && (
              <p className="mt-2xs flex items-center gap-xs text-[length:var(--nf-text-caption)] text-[var(--nf-content-muted)]">
                <UiIcon name="location" size={12} className="shrink-0" />
                <span className="truncate">{thread.listingTitle}</span>
              </p>
            )}
          </div>
          <span className="flex shrink-0 items-center gap-xs">
            {/* V-72: where this enquiry stands. */}
            {stage && deskCopy && (
              <span
                className={`nf-badge ${stage.stage === "lost" ? "nf-badge--warning" : "nf-badge--info"}`}
                data-testid="inbox-stage"
              >
                {stageWords(stage, deskCopy)}
              </span>
            )}
            {thread.unread > 0 && (
              <span className="nf-numeric nf-badge nf-badge--brand">{thread.unread}</span>
            )}
            <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
              {thread.whenLabel}
            </span>
          </span>
        </div>

        <p className="mt-sm line-clamp-2 text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-secondary)]">
          {thread.missedCall && missedWords ? (
            <span className="inline-flex items-center gap-inline-tight font-semibold text-[var(--nf-state-error)]" data-testid="inbox-missed-call">
              <UiIcon name="phone-missed" size={16} filled />
              {missedWords[thread.missedCall]}
            </span>
          ) : (
            thread.lastMessage
          )}
        </p>

        {/* V-14: a still-available question waiting on a one-tap answer. */}
        {askedLabel && (
          <p className="mt-sm" data-testid="inbox-still-available">
            <span className="nf-badge nf-badge--info">{askedLabel}</span>
          </p>
        )}

        {thread.waitingOnYou && (
          <p className="mt-sm flex items-center gap-xs text-[length:var(--nf-text-overline)] font-semibold text-[var(--nf-state-warning)]">
            <UiIcon name="bell" size={12} className="shrink-0" />
            {waitLabel(thread.waitingHours)}
          </p>
        )}
      </Link>
    </li>
  );
}

export function AgentInbox({
  inbox,
  filter,
  asked,
  askedLabel,
  stages,
  stage,
  deskCopy,
  briefsLabel,
  missedWords,
  dueIds,
  dueCopy,
}: {
  /**
   * AGENT-01: the threads whose follow-up is due today (or earlier and still
   * open), or null when the follow-ups could not be read, which draws no
   * "Due today" chip rather than one that says "none".
   */
  dueIds?: ReadonlySet<string> | null;
  dueCopy?: DueCopy;
  /** VC1: the missed-call line's words. */
  missedWords?: { VIDEO: string; AUDIO: string };
  inbox: Inbox;
  filter: InboxFilter;
  /**
   * V-72: each thread's stage, or null when the desk could not be read (then
   * no stage is drawn and no stage filter offered, rather than every thread
   * shown as New).
   */
  stages?: ReadonlyMap<string, DeskStage> | null;
  /** V-72: the stage filter from the address bar, or null for none. */
  stage?: Stage | null;
  deskCopy?: DeskCopy;
  /** V-14: thread ids with an unanswered still-available question. */
  asked?: ReadonlySet<string>;
  askedLabel?: string;
  /** V-95: the label of the Briefs filter; absent draws no such chip. */
  briefsLabel?: string;
}) {
  const staged = stages && deskCopy ? stages : null;
  const activeStage = staged ? (stage ?? null) : null;
  const due = dueIds && dueCopy ? dueIds : null;
  const threads =
    activeStage !== null
      ? inbox.threads.filter((t) => staged?.get(t.id)?.stage === activeStage)
      : filter === "due" && due
        ? inbox.threads.filter((t) => due.has(t.id))
        : filter === "waiting"
          ? inbox.threads.filter((t) => t.waitingOnYou)
          : inbox.threads;
  const stageCounts = staged
    ? countByStage(inbox.threads.flatMap((t) => (staged.get(t.id) ? [staged.get(t.id)!] : [])))
    : null;

  const chips: { key: InboxFilter; label: string; count: number }[] = [
    { key: "waiting", label: "Waiting on you", count: inbox.waitingCount },
    { key: "all", label: "All enquiries", count: inbox.threads.length },
  ];

  return (
    <div>
      {/* The shared rail. A selected link chip is describing where the reader
          already is, so the primitive marks it `aria-current="page"` rather
          than pressed, and paints selection as a ring and a fill instead of the
          `.nf-chip--active` border glow that a phone in daylight cannot show. */}
      <nav aria-label="Filter enquiries">
        <ChipRow bleed={false}>
          {chips.map((chip) => (
            <Chip
              key={chip.key}
              behaviour="link"
              href={chip.key === "all" ? "/agent/messages?filter=all" : "/agent/messages"}
              selected={activeStage === null && chip.key === filter}
              count={chip.count}
            >
              {chip.label}
            </Chip>
          ))}
          {due && dueCopy && (
            <Chip
              behaviour="link"
              href="/agent/messages?filter=due"
              selected={activeStage === null && filter === "due"}
              count={due.size}
            >
              {dueCopy.chip}
            </Chip>
          )}
          {briefsLabel && (
            <Chip behaviour="link" href="/agent/messages?filter=briefs" selected={false}>
              {briefsLabel}
            </Chip>
          )}
        </ChipRow>
      </nav>

      {/* V-72: the desk. Every stage with its count; the filter travels in
          the address bar like the one above, so a filtered desk is a link. */}
      {stageCounts && deskCopy && (
        <nav aria-label={deskCopy.filterLabel} className="mt-sm" data-testid="inbox-stages">
          <ChipRow bleed={false}>
            {STAGES.map((s) => (
              <Chip
                key={s}
                behaviour="link"
                href={activeStage === s ? "/agent/messages?filter=all" : `/agent/messages?stage=${s}`}
                selected={activeStage === s}
                count={stageCounts[s]}
                size="sm"
              >
                {deskCopy.stages[s]}
              </Chip>
            ))}
          </ChipRow>
        </nav>
      )}

      {threads.length > 0 ? (
        /* `grid-cols-1` rather than a bare `grid`: an implicit `auto` track
           will not shrink below its item's min-content, which is how the
           reviews list came to be 395px wide inside a 358px column. */
        <ul className="mt-md grid grid-cols-1 gap-sm">
          {threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              askedLabel={asked?.has(thread.id) ? askedLabel : undefined}
              stage={staged?.get(thread.id)}
              deskCopy={deskCopy}
              missedWords={missedWords}
            />
          ))}
        </ul>
      ) : activeStage !== null && deskCopy ? (
        <div className="nf-panel nf-panel--card block mt-md p-xl text-center" data-testid="inbox-stage-empty">
          <p className="font-semibold text-[var(--nf-content-primary)]">{deskCopy.emptyStage}</p>
          <p className="mx-auto mt-2xs max-w-[40ch] text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
            {deskCopy.emptyStageBody}
          </p>
          <Link href="/agent/messages?filter=all" className="nf-btn nf-btn--glass mt-md">
            {deskCopy.all}
          </Link>
        </div>
      ) : filter === "due" && due && dueCopy ? (
        <div className="nf-panel nf-panel--card block mt-md p-xl text-center" data-testid="inbox-due-empty">
          <p className="font-semibold text-[var(--nf-content-primary)]">{dueCopy.empty}</p>
          <p className="mx-auto mt-2xs max-w-[40ch] text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
            {dueCopy.emptyBody}
          </p>
          <Link href="/agent/messages?filter=all" className="nf-btn nf-btn--glass mt-md">
            {deskCopy?.all ?? "All"}
          </Link>
        </div>
      ) : (
        <div className="nf-panel nf-panel--card block mt-md p-xl text-center">
          <IconPlate size="lg">
            <UiIcon name="messages" size={24} />
          </IconPlate>
          <p className="mt-md font-semibold text-[var(--nf-content-primary)]">
            {filter === "waiting" ? "Nobody is waiting on you" : "No enquiries yet"}
          </p>
          <p className="mx-auto mt-2xs max-w-[40ch] text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-muted)]">
            {filter === "waiting"
              ? "Every enquiry has had your reply. That is exactly how a guest decides to book."
              : "When a guest messages you about one of your listings, the thread lands here."}
          </p>
          {filter === "waiting" && inbox.threads.length > 0 && (
            <Link href="/agent/messages?filter=all" className="nf-btn nf-btn--glass mt-md">
              See all enquiries
            </Link>
          )}
          {inbox.threads.length === 0 && (
            <Link href="/agent/listings" className="nf-btn nf-btn--primary mt-md">
              My listings
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
