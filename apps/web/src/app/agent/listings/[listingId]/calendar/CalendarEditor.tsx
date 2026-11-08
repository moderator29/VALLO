"use client";

import { Button } from "@/components/ui/Button";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions/envelope";
import { blockNights, unblockNights } from "@/lib/agent/calendar-actions";
import { monthGrid, countNights } from "@/lib/agent/calendar-model";
import type { CalendarNight, CalendarSubject } from "@/lib/agent/calendar-queries";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { EmptyState } from "@/components/app/Screen";
import { countOf } from "@vallo/i18n/core";
import { useClientLocale } from "@/lib/i18n/use-client-locale";
import { useActionBanner } from "@/components/ui/use-action-banner";

/**
 * The host's calendar.
 *
 * Tap a night to start a run, tap a second to finish it, then close or reopen
 * the run. A night with a real booking on it is locked and says so: the
 * bookings loop owns those rows and closing over one would tell a host a guest
 * is not coming when they are.
 *
 * The grid is built from calendar dates in Lagos, never from moments in time,
 * so a host in another timezone still sees their own nights.
 */

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS_SHOWN = 4;

type Mode = "booked" | "blocked" | "free" | "past";

export function CalendarEditor({
  subject,
  nights,
}: {
  subject: CalendarSubject;
  nights: CalendarNight[];
}) {
  const locale = useClientLocale();
  const router = useRouter();
  const [anchor, setAnchor] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  const [blockState, blockAction, blocking] = useActionState<
    ActionResult<null> | null,
    FormData
  >(blockNights, null);
  const [openState, openAction, opening] = useActionState<ActionResult<null> | null, FormData>(
    unblockNights,
    null,
  );

  /* Blocked, opened or refused, said by the one banner at the top of the
     screen (founder, 7 November 2026, "THE BANNER EVERYWHERE"). */
  useActionBanner(blockState, { ok: "Dates blocked" });
  useActionBanner(openState, { ok: "Dates open again" });

  const statusByDate = useMemo(() => {
    const map = new Map<string, "booked" | "unavailable">();
    for (const night of nights) map.set(night.date, night.status);
    return map;
  }, [nights]);

  useEffect(() => {
    if (blockState?.ok || openState?.ok) {
      setAnchor(null);
      setEnd(null);
      router.refresh();
    }
  }, [blockState, openState, router]);

  const months = useMemo(() => {
    const [y, m] = subject.today.split("-").map(Number);
    const out: { year: number; month: number; cells: (string | null)[] }[] = [];
    for (let i = 0; i < MONTHS_SHOWN; i += 1) {
      const d = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1 + i, 1));
      out.push({
        year: d.getUTCFullYear(),
        month: d.getUTCMonth(),
        cells: monthGrid(d.getUTCFullYear(), d.getUTCMonth()),
      });
    }
    return out;
  }, [subject.today]);

  const from = anchor && end ? (anchor <= end ? anchor : end) : anchor;
  const to = anchor && end ? (anchor <= end ? end : anchor) : anchor;

  function modeOf(date: string): Mode {
    if (date < subject.today) return "past";
    const status = statusByDate.get(date);
    if (status === "booked") return "booked";
    if (status === "unavailable") return "blocked";
    return "free";
  }

  function onPick(date: string) {
    if (modeOf(date) === "past" || modeOf(date) === "booked") return;
    if (anchor === null || (anchor !== null && end !== null)) {
      setAnchor(date);
      setEnd(null);
      return;
    }
    setEnd(date);
  }

  const selectedCount = from && to ? countNights(from, to) : 0;
  /*
   * THE FIRST RUN, WHICH IS EVERY LISTING ON THE DAY IT IS MADE.
   *
   * `nights` carries only what is closed or booked, so an empty array is not a
   * failure and not a blank screen: it is a calendar with every date open. The
   * grid still has to be here, because the grid IS the tool and hiding it would
   * take away the one thing this screen does. What was missing was any word
   * about it at the top. A host opening this for the first time met a legend,
   * four identical grey months, and the only instruction four screens further
   * down, past the scroll. So on a calendar with nothing on it yet this says
   * what is not there, why, and what to do next, above the grid it is about,
   * and it goes away for good the moment one night is closed or booked.
   */
  const untouched = nights.length === 0;

  return (
    <div>
      {untouched && (
        <EmptyState
          icon="calendar-grid"
          title="No nights closed yet"
          body="Every date on this listing is open and nothing is booked, so a guest can ask for any of them. Tap a night below to start a run, then tap another to finish it."
          data-testid="calendar-empty"
        />
      )}

      <ul className="mb-md flex flex-wrap items-center gap-x-md gap-y-xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
        <Key className="bg-[var(--nf-surface-raised)]" label="Open" />
        <Key className="bg-[var(--nf-brand-primary)]" label="Closed by you" />
        <Key className="bg-[var(--nf-state-success)]" label="Booked" />
      </ul>

      <div className="grid gap-lg">
        {months.map((month) => (
          <section key={`${month.year}-${month.month}`}>
            <h2 className="nf-overline mb-xs text-[var(--nf-content-muted)]">
              {new Date(Date.UTC(month.year, month.month, 1)).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </h2>
            {/* A GROUP OF NIGHT BUTTONS, NOT AN ARIA GRID. role="grid" promises
                rows and gridcells and arrow-key movement between them; this
                month has neither, so axe refused it (aria-required-children,
                4 findings, C1 sweep). Each button names its own date and
                state, so the weekday heads are for the eye only. */}
            <div
              className="grid grid-cols-7 gap-2xs"
              role="group"
              aria-label={new Date(Date.UTC(month.year, month.month, 1)).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            >
              {WEEKDAYS.map((day) => (
                <span
                  aria-hidden="true"
                  key={day}
                  className="pb-2xs text-center text-[length:var(--nf-text-overline)] font-normal text-[var(--nf-content-muted)]"
                >
                  {day}
                </span>
              ))}
              {month.cells.map((date, i) => {
                if (date === null) return <span key={`pad-${i}`} aria-hidden="true" />;
                const mode = modeOf(date);
                const inRange = from !== null && to !== null && date >= from && date <= to;
                const day = Number(date.slice(8, 10));
                const disabled = mode === "past" || mode === "booked";
                return (
                  <button
                    key={date}
                    type="button"
                    onClick={() => onPick(date)}
                    disabled={disabled}
                    aria-pressed={inRange}
                    aria-label={`${date}, ${
                      mode === "booked"
                        ? "booked"
                        : mode === "blocked"
                          ? "closed"
                          : mode === "past"
                            ? "past"
                            : "open"
                    }`}
                    className={[
                      "nf-body-sm flex h-11 items-center justify-center rounded-[var(--nf-radius-sm)] font-normal transition-colors",
                      mode === "past" && "cursor-default text-[var(--nf-content-muted)] opacity-35",
                      /*
                       * `--nf-content-on-brand`, not `text-white`.
                       *
                       * These two cells are the only filled swatches on the
                       * calendar and both were painted with a raw white. In
                       * the dark theme that is right by accident; in the true
                       * light theme the token is what guarantees a readable
                       * figure on a saturated fill, and a literal is a
                       * dark-only assumption that nothing tells you about
                       * until somebody opens the calendar in daylight and
                       * cannot read which days are booked.
                       */
                      mode === "booked" &&
                        "cursor-default bg-[var(--nf-state-success)] text-[var(--nf-content-on-brand)] opacity-90",
                      mode === "blocked" &&
                        "bg-[var(--nf-brand-primary)] text-[var(--nf-content-on-brand)]",
                      mode === "free" &&
                        "bg-[var(--nf-surface-raised)] text-[var(--nf-content-primary)] hover:opacity-80",
                      inRange && "ring-2 ring-[var(--nf-brand-quiet)]",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* The action bar only appears once a run is chosen, so the surface is
          quiet until there is something to do with it. */}
      {from && to && (
        <div className="nf-panel nf-panel--card block sticky bottom-[calc(var(--nf-tabbar-clearance)+var(--nf-space-xs))] mt-lg p-md lg:bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <p className="text-[length:var(--nf-text-body-sm)] font-semibold text-[var(--nf-content-primary)]">
            {countOf(selectedCount, "nights", locale)} selected
          </p>
          <p className="nf-numeric mt-3xs text-[length:var(--nf-text-overline)] text-[var(--nf-content-muted)]">
            {from} to {to}
          </p>

          <div className="mt-sm grid gap-xs sm:grid-cols-2">
            <form action={blockAction}>
              <input type="hidden" name="listingId" value={subject.listingId} />
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="to" value={to} />
              <Button type="submit" variant="primary" full loading={blocking} disabled={blocking || opening}>
                {blocking ? "Closing..." : "Close these nights"}
              </Button>
            </form>
            <form action={openAction}>
              <input type="hidden" name="listingId" value={subject.listingId} />
              <input type="hidden" name="from" value={from} />
              <input type="hidden" name="to" value={to} />
              <Button type="submit" variant="secondary" full loading={opening} disabled={blocking || opening}>
                {opening ? "Reopening..." : "Reopen them"}
              </Button>
            </form>
          </div>

          <Button
            variant="quiet"
            size="sm"
            full
            className="mt-xs"
            onClick={() => {
              setAnchor(null);
              setEnd(null);
            }}
          >
            Clear selection
          </Button>

        </div>
      )}

      {/* Suppressed on a first run: the empty state above has already said how
          to start, and the locked-booking half of this sentence is about
          nights that do not exist yet on a calendar with nothing booked. */}
      {!from && !untouched && (
        <p className="mt-lg flex items-start gap-xs text-[length:var(--nf-text-caption)] leading-relaxed text-[var(--nf-content-muted)]">
          <UiIcon name="calendar-booking" size={16} className="mt-3xs shrink-0" />
          Tap a night to start, then tap another to finish the run. A night with
          a booking on it is locked, because a guest is already coming.
        </p>
      )}
    </div>
  );
}

function Key({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-xs">
      <span className={`block h-3 w-3 rounded-[var(--nf-radius-xs)] ${className}`} aria-hidden="true" />
      {label}
    </li>
  );
}
