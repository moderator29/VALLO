"use client";

import { dateTimeLabel } from "@/lib/format/when";
import Link from "next/link";
import { useActionState, useState } from "react";
import { useActionBanner } from "@/components/ui/use-action-banner";
import {
  liftAgentStop,
  stopAgentTrading,
  type LiftReceipt,
  type StopReceipt,
} from "@/lib/admin/suspension-actions";
import type { AgentStanding, StopRecord } from "@/lib/admin/suspension-queries";
import type { ActionResult } from "@/lib/actions/envelope";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { RecallPanel } from "./RecallPanel";
import { countOf, type Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";

/**
 * The stops desk.
 *
 * Stopping an agent is the heaviest thing this console does to somebody who has
 * done nothing criminal, so the whole design is about making the cost visible
 * before the decision rather than after it. The stop form says how many
 * listings will come down. The stopped card says exactly which ones came down
 * and where each will land if the stop is lifted. Nobody should ever press
 * either button and then find out what it did.
 *
 * The reason is required and it is long, because the agent reads it. It arrives
 * in their notifications word for word, and it is the whole basis on which they
 * can answer. A reason nobody could act on is not a reason.
 *
 * Confirmed stays are never cancelled by a stop, and the count is printed on
 * the card so an operator can see who is still owed a room.
 */

function statusWord(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

function dateLabel(iso: string | null): string {
  if (!iso) return "not recorded";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "not recorded";
  return dateTimeLabel(parsed);
}

/** Who signed a stop, distinguishing "nobody" from "somebody who has left". */
function signedBy(record: StopRecord): string {
  if (record.suspendedByName) return `Stopped by ${record.suspendedByName}`;
  if (record.suspendedBySignerGone) {
    return "Stopped by an administrator whose account has since been closed";
  }
  return "Stopped by an administrator";
}

function WithdrawnList({
  withdrawn,
  lifted,
  closedIds,
}: {
  withdrawn: StopRecord["withdrawn"];
  lifted: boolean;
  closedIds: ReadonlySet<string>;
}) {
  if (withdrawn.length === 0) {
    return (
      <p className="mt-row nf-body-sm text-[var(--nf-content-muted)]">
        Nothing of theirs was live, so nothing came down.
      </p>
    );
  }

  return (
    <ul className="mt-row space-y-inline">
      {withdrawn.map((listing) => {
        // A listing that is no longer where the stop left it will not move when
        // the stop is lifted, and saying so here is the difference between an
        // operator expecting three listings back and getting two.
        // A listing closed as let or unavailable while the agent was stopped is
        // held down by the database, not by the stop: lifting it leaves it
        // closed, and only a staff reopen on the listing page brings it back.
        const closed = closedIds.has(listing.id);
        const willReturn = !closed && listing.statusNow === "SUSPENDED";
        return (
          <li
            key={listing.id}
            className="flex flex-wrap items-baseline gap-x-xs gap-y-3xs border-t border-[var(--nf-divider)] pt-inline nf-body-sm"
          >
            <span className="min-w-0 flex-1 break-words text-[var(--nf-content-primary)]">
              {listing.title ?? "A listing that has since been deleted"}
            </span>
            <span className="nf-caption text-[var(--nf-content-muted)]">
              {closed
                ? "closed, stays closed"
                : lifted
                ? `was ${statusWord(listing.from).toLowerCase()}`
                : willReturn
                  ? `returns to ${statusWord(listing.from).toLowerCase()}`
                  : listing.statusNow
                    ? `now ${statusWord(listing.statusNow).toLowerCase()}, stays as it is`
                    : "deleted since, stays as it is"}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function StopHistory({ records }: { records: StopRecord[] }) {
  if (records.length === 0) return null;

  return (
    <details className="mt-heading">
      {/* The 44px floor on a disclosure an operator taps to open a case file. */}
      <summary className="flex min-h-11 cursor-pointer items-center nf-body-sm font-semibold text-[var(--nf-content-secondary)]">
        {countOf(records.length, "earlierStops")}
      </summary>
      <ul className="mt-row space-y-row">
        {records.map((record) => (
          <li key={record.id} className="border-t border-[var(--nf-divider)] pt-row">
            <p className="nf-body-sm leading-relaxed text-[var(--nf-content-primary)]">
              {record.reason}
            </p>
            <p className="mt-inline-tight nf-caption text-[var(--nf-content-muted)]">
              {signedBy(record)} on {dateLabel(record.suspendedAt)}. Lifted by{" "}
              {record.liftedByName ?? "an administrator"} on {dateLabel(record.liftedAt)}.{" "}
              {record.restoredCount === 0
                ? "Nothing was put back."
                : countOf(record.restoredCount, "listingsPutBack")}
            </p>
            {record.liftNote && (
              <p className="mt-inline-tight nf-caption italic text-[var(--nf-content-secondary)]">
                {record.liftNote}
              </p>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function StoppedCard({
  agent,
  action,
  state,
  pending,
  closedIds,
  recallCopy,
}: {
  agent: AgentStanding;
  recallCopy: Dictionary["trustVisible"]["desk"];
  closedIds: ReadonlySet<string>;
  action: (formData: FormData) => void;
  state: ActionResult<LiftReceipt> | null;
  pending: boolean;
}) {
  const stop = agent.openStop;
  const mine = state && state.ok && state.data.agentId === agent.agentId;

  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-card">
      <div className="flex flex-wrap items-center gap-xs">
        <span
          className="nf-badge shrink-0"
          style={{
            background: "var(--nf-status-rejected-surface)",
            color: "var(--nf-status-rejected)",
          }}
        >
          Stopped
        </span>
        <h3 className="nf-lede font-semibold text-[var(--nf-content-primary)]">
          <Link href={`/admin/people/${agent.userId}`} className="underline-offset-2 hover:underline">
            {agent.displayName}
          </Link>
        </h3>
      </div>

      {stop ? (
        <>
          <p className="mt-heading nf-body leading-relaxed text-[var(--nf-content-primary)]">
            {stop.reason}
          </p>
          <p className="mt-inline-tight nf-caption text-[var(--nf-content-muted)]">
            {signedBy(stop)} on {dateLabel(stop.suspendedAt)}.
          </p>

          {stop.staysAhead > 0 && (
            <p className="mt-row nf-body-sm leading-relaxed text-[var(--nf-content-secondary)]">
              {countOf(stop.staysAhead, "staysStillAhead")}
            </p>
          )}

          {/* 0.6875rem, which is 11px, uppercase and tracked, on the heading
              over the list of a person's withdrawn inventory. `nf-overline` is
              the platform's own answer for a label above a section. */}
          <h4 className="mt-heading nf-overline text-[var(--nf-content-muted)]">
            What came down
          </h4>
          <WithdrawnList withdrawn={stop.withdrawn} lifted={false} closedIds={closedIds} />

          {/* V-60: tell everybody this account talked to, counted first. */}
          <RecallPanel suspensionId={stop.id} desk={recallCopy} />
        </>
      ) : (
        <p className="mt-heading nf-body-sm leading-relaxed text-[var(--nf-state-warning)]">
          This agent reads as stopped but nothing on the file explains why. Lifting will put them
          back to trading and record that there was nothing to restore.
        </p>
      )}

      <form action={action} className="mt-block">
        <input type="hidden" name="agentId" value={agent.agentId} />
        <label className="block">
          <span className="nf-label">Note for the record</span>
          <textarea
            name="note"
            rows={2}
            placeholder="What changed. Optional, and kept on the file."
            className="nf-field"
          />
        </label>
        <Button variant="primary" size="sm" className="mt-heading" type="submit" disabled={pending}>
          {pending ? "Letting them back" : "Let them back"}
        </Button>
      </form>

      {mine && (
        <p role="status" className="mt-row nf-body-sm text-[var(--nf-status-approved)]">
          {state.data.displayName} is trading again.{" "}
          {state.data.restoredCount === 0
            ? "Nothing needed putting back."
            : countOf(state.data.restoredCount, "listingsBack")}
          {state.data.restoredCount < state.data.withdrawnCount &&
            ` ${state.data.withdrawnCount - state.data.restoredCount} had moved since and were left alone.`}
        </p>
      )}

      <StopHistory records={agent.pastStops} />
    </li>
  );
}

function TradingCard({
  agent,
  action,
  state,
  pending,
}: {
  agent: AgentStanding;
  action: (formData: FormData) => void;
  state: ActionResult<StopReceipt> | null;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const mine = state && state.ok && state.data.agentId === agent.agentId;
  const fieldError =
    state && !state.ok && open ? (state.fieldErrors?.reason ?? undefined) : undefined;

  return (
    <li className="nf-panel nf-panel--card nf-admin-card p-card">
      <div className="flex flex-wrap items-center gap-xs">
        <h3 className="min-w-0 flex-1 nf-body font-semibold text-[var(--nf-content-primary)]">
          <Link href={`/admin/people/${agent.userId}`} className="underline-offset-2 hover:underline">
            {agent.displayName}
          </Link>
        </h3>
        <span className="nf-numeric nf-caption text-[var(--nf-content-muted)]">
          {countOf(agent.liveListingCount, "liveListings")}
        </span>
      </div>

      {agent.pastStops.length > 0 && (
        <p className="mt-inline-tight nf-caption text-[var(--nf-content-muted)]">
          {countOf(agent.pastStops.length, "stoppedBefore")}
        </p>
      )}

      {open ? (
        <form action={action} noValidate className="mt-heading">
          <input type="hidden" name="agentId" value={agent.agentId} />
          <label className="block">
            <span className="nf-label">Why they are being stopped</span>
            <textarea
              name="reason"
              rows={3}
              autoFocus
              aria-invalid={fieldError ? true : undefined}
              placeholder="The agent reads this word for word. Say what happened and what would put it right."
              className="nf-field"
            />
            {fieldError && (
              <span className="mt-inline block nf-body-sm text-[var(--nf-state-warning)]">
                {fieldError}
              </span>
            )}
          </label>

          <p className="mt-row nf-body-sm leading-relaxed text-[var(--nf-content-secondary)]">
            {agent.liveListingCount === 0
              ? "Nothing of theirs is live, so nothing will come down."
              : countOf(agent.liveListingCount, "liveListingsComeDown")}{" "}
            Confirmed stays are never cancelled.
          </p>

          <div className="mt-heading flex flex-wrap gap-xs">
            <Button variant="danger" size="sm" type="submit" disabled={pending}>
              {pending ? "Stopping" : "Stop them trading"}
            </Button>
            <Button variant="quiet" size="sm" type="button" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button variant="quiet" size="sm" className="mt-heading" type="button" onClick={() => setOpen(true)}>
          Stop this agent
        </Button>
      )}

      {mine && (
        <p role="status" className="mt-row nf-body-sm text-[var(--nf-status-approved)]">
          {state.data.displayName} has been stopped and told why.{" "}
          {state.data.withdrawnCount === 0
            ? "Nothing was live."
            : countOf(state.data.withdrawnCount, "listingsCameDown")}
          {state.data.staysAhead > 0 &&
            ` ${countOf(state.data.staysAhead, "confirmedStaysAre")} untouched.`}
        </p>
      )}

      <StopHistory records={agent.pastStops} />
    </li>
  );
}

export function StopsDesk({
  stopped,
  trading,
  closedIds = [],
  recallCopy,
}: {
  /** The recall panel's words, from the server page. */
  recallCopy: Dictionary["trustVisible"]["desk"];
  stopped: AgentStanding[];
  trading: AgentStanding[];
  /** Withdrawn listings since closed as let or unavailable. They stay closed when a stop lifts. */
  closedIds?: readonly string[];
}) {
  const closed = new Set(closedIds);
  const [stopState, stopAction, stopPending] = useActionState<
    ActionResult<StopReceipt> | null,
    FormData
  >(stopAgentTrading, null);
  const [liftState, liftAction, liftPending] = useActionState<
    ActionResult<LiftReceipt> | null,
    FormData
  >(liftAgentStop, null);
  /* A refusal is said by the one banner at the top of the screen (Grade 1);
     the banner also says what was done (founder, 7 November 2026), and the
     agent's card keeps the counts as its record. */
  useActionBanner(liftState, { ok: liftState?.ok ? `${liftState.data.displayName} is trading again` : undefined });
  useActionBanner(stopState && !stopState.ok && stopState.fieldErrors?.reason ? null : stopState, {
    ok: stopState?.ok ? `${stopState.data.displayName} has been stopped and told why` : undefined,
  });

  return (
    <div className="space-y-section-tight">
      <section aria-label="Stopped">
        <h2 className="nf-h4 text-[var(--nf-content-primary)]">
          Stopped {stopped.length > 0 && <span className="nf-numeric">({stopped.length})</span>}
        </h2>

        {stopped.length === 0 ? (
          /* An empty state draws no container anywhere else in the product, and
             the message here is that there is nothing to see. */
          <div className="mt-heading p-card text-center">
            {/*
              NO PLATE. The last hand-built tinted disc in this owner's scope,
              and the same one `admin/_components/ui.tsx` lost four of:
              `docs/ICON_SYSTEM.md` records that a tinted tile behind a glyph
              came from the retired reference brief and is not part of this
              system, and on the light theme a soft wash on white reads as a
              hue this brand has banned by name. What stops a lone object
              floating is its SIZE and the air around it, not a box, so the
              glyph goes up to 40 - the top of `UI_ICON_SIZES`, which exists for
              exactly this - and the wash becomes ink.
            */}
            <span
              className="mx-auto flex justify-center"
              style={{ color: "var(--nf-status-approved)" }}
            >
              <UiIcon name="verified" size={40} />
            </span>
            <p className="mt-heading nf-body font-semibold text-[var(--nf-content-primary)]">
              Nobody is stopped
            </p>
            <p className="mx-auto mt-row max-w-[44ch] nf-body-sm leading-relaxed text-[var(--nf-content-secondary)]">
              Every agent on the platform is trading. A stop taken here comes with a reason the
              agent reads, and it can always be lifted.
            </p>
          </div>
        ) : (
          <ul className="mt-heading space-y-row">
            {stopped.map((agent) => (
              <StoppedCard
                key={agent.agentId}
                agent={agent}
                closedIds={closed}
                recallCopy={recallCopy}
                action={liftAction}
                state={liftState}
                pending={liftPending}
              />
            ))}
          </ul>
        )}

      </section>

      <section aria-label="Trading">
        <div className="flex flex-wrap items-baseline justify-between gap-row">
          <h2 className="nf-h4 text-[var(--nf-content-primary)]">
            Trading <span className="nf-numeric">({trading.length})</span>
          </h2>
        </div>
        <p className="mt-row max-w-[62ch] nf-body-sm leading-relaxed text-[var(--nf-content-muted)]">
          Every approved agent. A stop takes down everything of theirs that is live and tells them
          why, in your words.
        </p>

        {/*
          THE SECOND SEARCH BOX IS GONE, AND IT HAD TO GO.

          This held its own `useState` search and filtered `trading` in the
          browser. That is the fault the console spent this sprint removing from
          `/admin/bookings`: narrowing the rows that were already fetched. It
          was harmless while the read returned every approved agent, and it
          stopped being harmless the moment that read became one page of forty,
          because a box promising "find an agent by name" would then have
          searched the forty on screen and said nothing about the rest.

          The search is in the address bar now, on `QueueFilters` above, and it
          is an `ilike` inside Postgres. One box, and it reads the whole table.
        */}
        {trading.length === 0 ? (
          <p className="mt-heading nf-body-sm text-[var(--nf-content-muted)]">
            No agent is approved yet, so there is nobody who could be stopped.
          </p>
        ) : (
          <ul className="mt-heading space-y-row">
            {trading.map((agent) => (
              <TradingCard
                key={agent.agentId}
                agent={agent}
                action={stopAction}
                state={stopState}
                pending={stopPending}
              />
            ))}
          </ul>
        )}

      </section>
    </div>
  );
}
