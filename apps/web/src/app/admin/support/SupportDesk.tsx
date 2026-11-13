import { agoShort, dateTimeLabel } from "@/lib/format/when";
import Link from "next/link";
import { countOf } from "@vallo/i18n/core";
import type { ReactNode } from "react";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusPill, type StatusTone } from "@/components/ui/StatusPill";
import { TICKET_STATUS, type TicketStatus } from "@/lib/support/tickets";
import { supportTopicLabel } from "@/lib/trust/support-topics";
import {
  ESCALATION_TARGET_LABEL,
  inTab,
  SUPPORT_TAB_LABEL,
  SUPPORT_TABS,
  suggestedEscalation,
  tabCounts,
  type SupportLane,
  type SupportQueueRow,
  type SupportTab,
  type SupportTicketDetail,
} from "@/lib/admin/support-workspace";
import { TicketStatusControl } from "../_components/AdminActions";
import { NoteForm } from "../_components/NoteForm";
import { CalmNote, PageHead, Panel } from "../_components/panels";
import type { AdminCopy } from "../_components/copy";
import { TicketClaim } from "./TicketClaim";
import { ReviewCallAction } from "@/components/calls/admin/ReviewCallAction";
import { SupportComposer } from "./SupportComposer";
import { ReturnEscalation, SupportEscalate } from "./SupportEscalate";
import { SupportKeys } from "./SupportKeys";

/**
 * THE SUPPORT DESK (29 September 2026): where a support agent lands and
 * works. A queue on the left in lanes (new, waiting on us, waiting on the
 * member, escalated, done), ordered late first, each row carrying the promise
 * it is under and how long is left; the open ticket on the right with the
 * thread, the reply box and its saved replies, the status, the hand-off to
 * another desk, and beside it only what support needs about the member, the
 * internal notes and the ticket's audit trail. On a phone the queue and the
 * ticket are one column each, the ticket first when one is open.
 *
 * Pure presentation: every value arrives as props (lib/admin/support-queue.ts
 * on the real page, fixtures in the preview harness), and every button calls
 * an action that checks the door again on the server.
 */

export type SupportDeskProps = {
  now: number;
  tab: SupportTab;
  q: string;
  queue: { state: "ok"; rows: SupportQueueRow[]; escalationsInstalled: boolean } | { state: "unavailable" } | { state: "none" };
  selected: SupportTicketDetail | null;
  /** Why a ticket asked for by link is not shown. */
  missing: "unknown" | "unavailable" | "forbidden" | null;
  copy: AdminCopy["support"];
};

const LANE_WORDS: Record<SupportLane, string> = {
  new: "New",
  waiting_on_us: "Waiting on us",
  waiting_on_member: "Waiting on member",
  escalated: "Escalated",
  done: "Done",
};

const LANE_TONE: Record<SupportLane, StatusTone> = {
  new: "brand",
  waiting_on_us: "warning",
  waiting_on_member: "neutral",
  escalated: "info",
  done: "success",
};

function when(iso: string | null): string {
  if (!iso) return "not recorded";
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "not recorded";
  return dateTimeLabel(at);
}

/* The console's dense age (lib/format/when.ts): "12m ago", then the date. */
function ago(iso: string, now: number): string {
  return agoShort(iso, { now }) || "just now";
}

function statusWord(status: string): { label: string; tone: StatusTone } {
  const s = TICKET_STATUS[status as TicketStatus];
  if (!s) return { label: status, tone: "neutral" };
  return { label: s.label, tone: s.tone === "brand" ? "brand" : s.tone };
}

export function supportHref(input: { tab: SupportTab; q: string; ticket?: string | null }): string {
  const p = new URLSearchParams();
  if (input.tab !== "open") p.set("tab", input.tab);
  if (input.q) p.set("q", input.q);
  if (input.ticket) p.set("ticket", input.ticket);
  const s = p.toString();
  return s ? `/admin/support?${s}` : "/admin/support";
}

function Sla({ row }: { row: SupportQueueRow }) {
  return (
    <StatusPill tone={row.sla.tone} size="sm" className="shrink-0">
      {row.sla.label}
    </StatusPill>
  );
}

function Tiles({ rows, q, now }: { rows: SupportQueueRow[]; q: string; now: number }) {
  const open = rows.filter((r) => r.lane !== "done");
  const late = open.filter((r) => r.sla.breached).length;
  const soon = open.filter((r) => !r.sla.breached && r.sla.dueAt && Date.parse(r.sla.dueAt) - now <= 4 * 3_600_000).length;
  const tiles: { key: string; label: string; value: number; caption: string; tab: SupportTab; tone: string }[] = [
    { key: "late", label: "Late", value: late, caption: "past the promise", tab: "open", tone: late > 0 ? "var(--nf-state-error)" : "var(--nf-content-primary)" },
    { key: "soon", label: "Due in 4 hours", value: soon, caption: "pick these up next", tab: "open", tone: soon > 0 ? "var(--nf-state-warning)" : "var(--nf-content-primary)" },
    {
      key: "member",
      label: "With the member",
      value: open.filter((r) => r.lane === "waiting_on_member").length,
      caption: "we answered last",
      tab: "waiting_on_member",
      tone: "var(--nf-content-primary)",
    },
    {
      key: "escalated",
      label: "Escalated",
      value: open.filter((r) => r.lane === "escalated").length,
      caption: "with money, safety or verification",
      tab: "escalated",
      tone: "var(--nf-content-primary)",
    },
  ];
  return (
    <section aria-label="The desk at a glance" className="mt-md grid grid-cols-2 gap-xs lg:grid-cols-4">
      {tiles.map((t) => (
        <Link
          key={t.key}
          href={supportHref({ tab: t.tab, q })}
          scroll={false}
          className="nf-panel nf-panel--card nf-card--interactive block p-sm"
          data-testid={`support-tile-${t.key}`}
        >
          <span className="nf-overline block text-[var(--nf-content-muted)]">{t.label}</span>
          <span className="nf-numeric block text-[length:var(--nf-text-h2)] font-semibold leading-tight" style={{ color: t.tone }}>
            {t.value}
          </span>
          <span className="nf-caption block text-[var(--nf-content-secondary)]">{t.caption}</span>
        </Link>
      ))}
    </section>
  );
}

function Tabs({ rows, tab, q }: { rows: SupportQueueRow[]; tab: SupportTab; q: string }) {
  const counts = tabCounts(rows.map((r) => ({ lane: r.lane, claimedByMe: r.claim?.mine === true })));
  return (
    <nav aria-label="Support lanes" className="nf-admin-seg mt-md flex-nowrap overflow-x-auto pb-3xs">
      {SUPPORT_TABS.map((t) => (
        <Link
          key={t}
          href={supportHref({ tab: t, q })}
          scroll={false}
          aria-current={t === tab ? "page" : undefined}
          className={`nf-admin-seg__item shrink-0${t === tab ? " nf-admin-seg__item--on" : ""}`}
        >
          {SUPPORT_TAB_LABEL[t]}
          {counts[t] > 0 && t !== "done" ? <span className="nf-admin-seg__count nf-numeric">{counts[t]}</span> : null}
        </Link>
      ))}
    </nav>
  );
}

function Row({ row, selected, href, now }: { row: SupportQueueRow; selected: boolean; href: string; now: number }) {
  return (
    <li>
      <Link
        href={href}
        scroll={false}
        aria-current={selected ? "true" : undefined}
        className={[
          "nf-panel nf-panel--card nf-card--interactive block p-sm",
          selected ? "ring-1 ring-[var(--nf-border-brand)]" : "",
        ].join(" ")}
        style={row.sla.breached ? { boxShadow: "inset 3px 0 0 var(--nf-state-error)" } : undefined}
        data-testid="support-row"
        data-lane={row.lane}
      >
        <span className="flex flex-wrap items-center gap-2xs">
          <Sla row={row} />
          <StatusPill tone={LANE_TONE[row.lane]} size="xs">
            {LANE_WORDS[row.lane]}
          </StatusPill>
          {row.escalatedTo.map((s) => (
            <StatusPill key={s} tone="info" size="xs">
              {ESCALATION_TARGET_LABEL[s].name}
            </StatusPill>
          ))}
          <span className="nf-numeric ml-auto text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{row.reference}</span>
        </span>
        <span className="mt-2xs block text-[length:var(--nf-text-body-sm)] font-semibold leading-snug text-[var(--nf-content-primary)]">
          {supportTopicLabel(row.topic) ?? "A general question"}
        </span>
        <span className="mt-3xs line-clamp-2 block text-[length:var(--nf-text-caption)] text-[var(--nf-content-secondary)] break-words">
          {row.preview}
        </span>
        <span className="mt-2xs flex flex-wrap items-center gap-x-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
          <span className="break-words">{row.name}</span>
          <span aria-hidden="true">·</span>
          <span>{ago(row.lastActivityAt, now)}</span>
          {row.replyCount > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{countOf(row.replyCount, "replies")}</span>
            </>
          ) : null}
          <span className="ml-auto font-semibold text-[var(--nf-content-secondary)]">
            {row.claim ? (row.claim.mine ? "You have it" : `${row.claim.name ?? "A colleague"} has it`) : "Nobody has it"}
          </span>
        </span>
      </Link>
    </li>
  );
}

function Section({ title, children, testId }: { title: string; children: ReactNode; testId?: string }) {
  return (
    <Panel title={title} className="mt-md" id={testId}>
      {children}
    </Panel>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-xs border-b border-[var(--nf-border-subtle)] py-2xs last:border-b-0">
      <dt className="nf-caption text-[var(--nf-content-muted)]">{label}</dt>
      <dd className="text-right text-[length:var(--nf-text-body-sm)] text-[var(--nf-content-primary)] break-words">{value}</dd>
    </div>
  );
}

function MemberContext({ detail, now }: { detail: SupportTicketDetail; now: number }) {
  const c = detail.context;
  const count = (n: number | null) => (n === null ? "Not shown to support yet" : String(n));
  return (
    <Section title="The member" testId="support-member">
      <dl>
        <Fact label="Name they gave" value={detail.row.name} />
        <Fact label="Email on the ticket" value={detail.email} />
        <Fact label="Account" value={c.hasAccount ? "Filed signed in" : "Filed without an account"} />
        {c.hasAccount ? (
          <>
            <Fact label="Member since" value={c.memberSince ? when(c.memberSince) : "Not shown to support yet"} />
            <Fact
              label="Lists property"
              value={c.isLister === null ? "Not shown to support yet" : c.isLister ? (c.listerVerified ? "Yes, verified" : "Yes, not verified yet") : "No"}
            />
            {c.badgeTier ? <Fact label="Badge" value={c.badgeTier.charAt(0).toUpperCase() + c.badgeTier.slice(1)} /> : null}
            <Fact label="Bookings" value={count(c.bookings)} />
            <Fact label="Agreements" value={count(c.agreements)} />
            {/* A desk this ticket was handed to sees this ticket only, not how many others there are. */}
            {detail.mode === "support" ? (
              <Fact
                label="Tickets"
                value={c.ticketsTotal === null ? "This is their first" : `${c.ticketsTotal} in all${c.ticketsOpen !== null ? `, ${c.ticketsOpen} open` : ""}`}
              />
            ) : null}
          </>
        ) : null}
        {detail.related ? (
          <Fact label="About" value={`${detail.related.kind.charAt(0).toUpperCase()}${detail.related.kind.slice(1)}${detail.related.label ? `: ${detail.related.label}` : ""}`} />
        ) : null}
      </dl>
      {c.recent.length > 0 ? (
        <>
          <p className="nf-overline mt-sm text-[var(--nf-content-muted)]">Their other tickets</p>
          <ul className="mt-2xs grid gap-2xs">
            {c.recent.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/admin/support?ticket=${t.id}`}
                  className="flex min-h-11 flex-wrap items-center gap-x-xs rounded-sm px-2xs text-[length:var(--nf-text-caption)] hover:bg-[var(--nf-glass-fill-strong)]"
                >
                  <span className="nf-numeric text-[var(--nf-content-muted)]">{t.reference}</span>
                  <span className="font-semibold">{supportTopicLabel(t.topic) ?? "A general question"}</span>
                  <span className="ml-auto text-[var(--nf-content-secondary)]">
                    {statusWord(t.status).label} · {ago(t.createdAt, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <p className="mt-sm nf-caption text-[var(--nf-content-muted)]">
        Support sees what helps answer this ticket. Identity documents, addresses, tax and company numbers and money
        records stay with their own desks.
        {c.source === "ticket" ? " The fuller member summary is not installed in this database; this is what the ticket carries." : ""}
      </p>
    </Section>
  );
}

function Notes({ detail }: { detail: SupportTicketDetail }) {
  return (
    <Section title="Internal notes" testId="support-notes">
      {detail.notes === null ? (
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">
          This ticket was filed without an account, so there is no member to keep notes on. Use the reply and the status.
        </p>
      ) : (
        <>
          {detail.notes === "unavailable" ? (
            <p className="nf-body-sm">Notes could not be read just now. Refresh to try again.</p>
          ) : detail.notes.length === 0 ? (
            <p className="nf-body-sm text-[var(--nf-content-secondary)]">No notes yet. The member never sees these.</p>
          ) : (
            <ul className="grid gap-xs">
              {detail.notes.map((n) => (
                <li key={n.id} className="rounded-sm bg-[var(--nf-surface-raised)] p-xs">
                  <p className="whitespace-pre-wrap text-[length:var(--nf-text-body-sm)]">{n.body}</p>
                  <p className="mt-3xs nf-caption text-[var(--nf-content-muted)]">
                    {n.mine ? "You" : n.author} · {when(n.at)}
                    {n.scopeLabel ? ` · only ${n.scopeLabel} and admins` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {detail.userId ? <NoteForm subjectId={detail.userId} path="/admin/support" scopes={detail.noteScopes} /> : null}
        </>
      )}
    </Section>
  );
}

function Trail({ detail }: { detail: SupportTicketDetail }) {
  return (
    <Section title="What happened on this ticket" testId="support-trail">
      {detail.trail === null ? (
        <p className="nf-body-sm">The trail could not be read just now.</p>
      ) : detail.trail.length === 0 ? (
        <p className="nf-body-sm text-[var(--nf-content-secondary)]">Nothing yet. Every take, reply, status change and hand-off is written here and to the audit log.</p>
      ) : (
        <ol className="grid gap-2xs">
          {detail.trail.map((t, i) => (
            <li key={`${t.at}-${i}`} className="text-[length:var(--nf-text-caption)]">
              <span className="font-semibold text-[var(--nf-content-primary)]">{t.who}</span>{" "}
              <span className="text-[var(--nf-content-secondary)]">{t.what}</span>
              {t.detail ? <span className="text-[var(--nf-content-secondary)] break-words">: {t.detail}</span> : null}
              <span className="block text-[var(--nf-content-muted)]">{when(t.at)}</span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function Ticket({
  detail,
  now,
  copy,
  escalationsInstalled,
  backHref,
}: {
  detail: SupportTicketDetail;
  now: number;
  copy: AdminCopy["support"];
  escalationsInstalled: boolean;
  backHref: string;
}) {
  const row = detail.row;
  const open = row.status === "open" || row.status === "pending";
  /* The same word the state control below uses, so the chip and the control agree. */
  const status = {
    ...statusWord(row.status),
    label: (copy.states as Record<string, string | undefined>)[row.status] ?? statusWord(row.status).label,
  };
  const live = (detail.escalations ?? []).filter((e) => !e.returnedAt);
  const past = (detail.escalations ?? []).filter((e) => e.returnedAt);
  const supportMode = detail.mode === "support";
  return (
    <article aria-label={`Ticket ${row.reference}`} data-testid="support-ticket">
      <div className="nf-panel nf-panel--card p-md sm:p-lg">
        <div className="flex flex-wrap items-center gap-2xs">
          <Sla row={row} />
          <StatusPill tone="neutral" size="sm">
            {row.sla.promise} promise
          </StatusPill>
          <StatusPill tone={status.tone} size="sm">
            {status.label}
          </StatusPill>
          <span className="nf-numeric text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{row.reference}</span>
          <Link
            href={backHref}
            scroll={false}
            className="ml-auto inline-flex min-h-11 items-center gap-2xs text-[length:var(--nf-text-caption)] font-semibold text-[var(--nf-content-link)] underline-offset-4 hover:underline lg:hidden"
          >
            <UiIcon name="arrow-left" size={16} />
            The queue
          </Link>
        </div>
        <h2 className="nf-h3 mt-xs">{supportTopicLabel(row.topic) ?? "A general question"}</h2>
        <p className="mt-3xs nf-caption text-[var(--nf-content-secondary)] break-words">
          From {row.name} · filed {when(row.createdAt)}
          {detail.waitingSince && open ? ` · waiting on us since ${when(detail.waitingSince)}` : ""}
        </p>

        {detail.mode === "escalated" ? (
          <p className="mt-sm rounded-md border border-[var(--nf-border-brand)] p-sm nf-body-sm" role="note">
            Support handed this ticket to your desk. You can read it, add a note, and hand it back with what you found.
            Support keeps talking to the member.
          </p>
        ) : null}

        {live.length > 0 ? (
          <ul className="mt-sm grid gap-xs" aria-label="Escalations">
            {live.map((e) => (
              <li key={e.id} className="rounded-md border border-[var(--nf-border-subtle)] bg-[var(--nf-surface-raised)] p-sm">
                <p className="nf-body-sm">
                  <span className="font-semibold">With the {ESCALATION_TARGET_LABEL[e.toScope].name.toLowerCase()} desk</span>
                  <span className="text-[var(--nf-content-secondary)]">
                    {" "}
                    since {when(e.at)}, from {e.byMe ? "you" : e.by}
                  </span>
                </p>
                <p className="mt-3xs whitespace-pre-wrap nf-caption text-[var(--nf-content-secondary)]">{e.reason}</p>
                <div className="mt-2xs">
                  <ReturnEscalation
                    ticketId={row.id}
                    escalationId={e.id}
                    label={supportMode ? "Take it back" : "Hand back to support"}
                  />
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {supportMode && open ? (
          <div className="mt-sm flex flex-wrap items-center gap-xs">
            <TicketClaim ticketId={row.id} holder={row.claim} />
            <span className="nf-caption text-[var(--nf-content-muted)]">
              <kbd className="nf-numeric">c</kbd> takes it
            </span>
          </div>
        ) : null}
      </div>

      <div className="mt-md grid gap-md xl:grid-cols-5">
        <div className="min-w-0 xl:col-span-3">
          <div className="nf-panel nf-panel--card p-md">
            <p className="nf-overline text-[var(--nf-content-muted)]">What they asked</p>
            <p className="mt-2xs whitespace-pre-wrap break-words text-[length:var(--nf-text-body-sm)] leading-relaxed">{detail.body}</p>
            {detail.thread.length > 0 ? (
              <ol className="mt-sm grid gap-xs" aria-label="The thread">
                {detail.thread.map((m) => (
                  <li
                    key={m.id}
                    className={`rounded-md p-sm ${m.role === "admin" ? "ml-lg bg-[var(--nf-brand-primary-soft)]" : "mr-lg bg-[var(--nf-surface-raised)]"}`}
                  >
                    <span className="flex flex-wrap items-center gap-xs">
                      <span className="nf-overline text-[var(--nf-content-muted)]">
                        {m.role === "admin" ? `Vallo support${m.by ? ` · ${m.by}` : ""}` : row.name}
                      </span>
                      <span className="text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">{when(m.at)}</span>
                    </span>
                    <p className="mt-2xs whitespace-pre-wrap break-words text-[length:var(--nf-text-body-sm)] leading-relaxed">{m.body}</p>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-sm nf-caption text-[var(--nf-content-muted)]">Nobody has replied yet.</p>
            )}

            {supportMode && open ? (
              <SupportComposer
                ticketId={row.id}
                status={row.status}
                firstName={detail.context.firstName}
                reference={row.reference}
                hasAccount={row.hasAccount}
              />
            ) : null}
            {supportMode ? <TicketStatusControl ticketId={row.id} status={row.status} copy={copy} /> : null}
          </div>

          {supportMode && open ? (
            <SupportEscalate
              ticketId={row.id}
              installed={escalationsInstalled && detail.escalations !== null}
              suggested={suggestedEscalation(row.topic)}
              taken={live.map((e) => e.toScope)}
            />
          ) : null}

          {/* VC1: a review call about this request (support scope, both switches on). */}
          {supportMode && open && row.hasAccount ? <ReviewCallAction caseKind="support_ticket" caseId={row.id} /> : null}

          {past.length > 0 ? (
            <Section title="Handed back">
              <ul className="grid gap-xs">
                {past.map((e) => (
                  <li key={e.id} className="nf-body-sm">
                    <span className="font-semibold">{ESCALATION_TARGET_LABEL[e.toScope].name}</span>
                    <span className="text-[var(--nf-content-secondary)]">
                      {" "}
                      handed back by {e.returnedBy ?? "a colleague"}, {when(e.returnedAt)}: {e.returnNote}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>
        <aside className="min-w-0 xl:col-span-2" aria-label="About this ticket">
          <MemberContext detail={detail} now={now} />
          <Notes detail={detail} />
          <Trail detail={detail} />
        </aside>
      </div>
    </article>
  );
}

export function SupportDesk({ now, tab, q, queue, selected, missing, copy }: SupportDeskProps) {
  const rows = queue.state === "ok" ? queue.rows : [];
  const shown = rows.filter((r) => inTab({ lane: r.lane, claimedByMe: r.claim?.mine === true }, tab));
  const hrefFor = Object.fromEntries(shown.map((r) => [r.id, supportHref({ tab, q, ticket: r.id })]));
  const waiting = rows.filter((r) => r.lane !== "done" && r.lane !== "waiting_on_member").length;
  const selectedId = selected?.row.id ?? null;
  const backHref = supportHref({ tab, q });

  return (
    <div className="nf-console" data-testid="support-desk">
      {/* The console's one header (`PageHead`, AD-01): the waiting count
          beside the title, the keyboard help at the end of the line. */}
      <PageHead
        title="Support"
        lede="Questions and complaints from members. Four hours for safety and money, one day for the rest, counted from the member's oldest unanswered message."
        trail={waiting > 0 ? <span className="nf-badge nf-badge--brand nf-numeric">{waiting} waiting on us</span> : undefined}
        action={
          queue.state === "ok" ? (
            <span className="shrink-0">
              <SupportKeys
                rows={shown.map((r) => ({ id: r.id, claimed: r.claim !== null, lane: r.lane }))}
                current={selectedId}
                hrefFor={hrefFor}
              />
            </span>
          ) : undefined
        }
      />

      {queue.state === "ok" ? (
        /* On a phone an open ticket gets the screen; the tiles, search and
           lanes come back with "The queue". */
        <div className={selected ? "hidden lg:block" : undefined}>
          <Tiles rows={rows} q={q} now={now} />
          <div className="mt-md flex flex-wrap items-end gap-xs">
            <form action="/admin/support" method="get" className="flex min-w-0 flex-1 flex-wrap items-end gap-xs" role="search">
              {tab !== "open" ? <input type="hidden" name="tab" value={tab} /> : null}
              <label className="grid min-w-0 flex-1 gap-2xs">
                <span className="nf-label">Find a ticket</span>
                <input
                  className="nf-field w-full"
                  type="search"
                  enterKeyHint="search"
                  name="q"
                  defaultValue={q}
                  placeholder="Reference or email address"
                  aria-label="Find a ticket by reference or email address"
                />
              </label>
              <Button type="submit" variant="secondary" leadingIcon="search">
                Find
              </Button>
              {q ? (
                <ButtonLink href={supportHref({ tab, q: "" })} variant="quiet">
                  Clear
                </ButtonLink>
              ) : null}
            </form>
          </div>
          <Tabs rows={rows} tab={tab} q={q} />
        </div>
      ) : null}

      {missing ? (
        <div className="mt-md">
          <CalmNote
            kind={missing === "unavailable" ? "error" : "info"}
            title={missing === "unavailable" ? "That ticket did not load" : "No ticket to open"}
            fills={
              missing === "unavailable"
                ? "The ticket could not be read just now. Reload to try again; nothing was changed."
                : missing === "forbidden"
                  ? "That ticket is not on your desk. If another desk handed it to you, it has been handed back."
                  : "No ticket has that id. It may have been typed or copied wrongly."
            }
            action={queue.state === "ok" ? { href: backHref, label: "Back to the queue" } : undefined}
          />
        </div>
      ) : null}

      {queue.state === "unavailable" ? (
        <div className="mt-md">
          <CalmNote kind="error" title="The queue did not load" fills="Tickets could not be read just now. Nothing was changed. Reload to try again." />
        </div>
      ) : null}

      <div className="mt-md grid gap-lg lg:grid-cols-12">
        {queue.state === "ok" ? (
          <section
            aria-label={`${SUPPORT_TAB_LABEL[tab]} tickets`}
            className={`min-w-0 lg:col-span-5 xl:col-span-4 ${selected ? "hidden lg:block" : ""}`}
          >
            {shown.length === 0 ? (
              <CalmNote
                kind={tab === "open" || tab === "new" || tab === "waiting_on_us" ? "clear" : "info"}
                title={
                  q
                    ? "Nothing matches that search"
                    : tab === "open"
                      ? "Nobody is waiting"
                      : tab === "mine"
                        ? "You hold no tickets"
                        : `Nothing in ${SUPPORT_TAB_LABEL[tab]}`
                }
                fills={
                  q
                    ? "Search looks at the ticket reference and the email address the member gave."
                    : tab === "open"
                      ? "Every member who wrote in has an answer. New tickets appear here and you are told in the app."
                      : tab === "mine"
                        ? "Take a ticket from All open with c, or open one and press Take it."
                        : "Tickets move here on their own as members and the team write."
                }
                action={q ? { href: supportHref({ tab, q: "" }), label: "Clear the search" } : undefined}
              />
            ) : (
              <ul className="grid gap-xs" data-testid="support-queue">
                {shown.map((row) => (
                  <Row key={row.id} row={row} selected={row.id === selectedId} href={hrefFor[row.id]!} now={now} />
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <section
          aria-label="The open ticket"
          className={`min-w-0 ${queue.state === "ok" ? "lg:col-span-7 xl:col-span-8" : "lg:col-span-12"} ${selected ? "" : "hidden lg:block"}`}
        >
          {selected ? (
            <Ticket
              detail={selected}
              now={now}
              copy={copy}
              escalationsInstalled={queue.state === "ok" ? queue.escalationsInstalled : true}
              backHref={backHref}
            />
          ) : queue.state === "ok" ? (
            <CalmNote
              title="Open a ticket"
              fills="Pick one from the queue, or press n for the next one nobody holds. Press ? for every key."
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}
