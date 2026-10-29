"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { countOf, plural, type Dictionary, type Locale } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { InitialsTile } from "@/components/ui/InitialsTile";
import { StatusPill } from "@/components/ui/StatusPill";
import { markStay } from "@/lib/host/front-desk-actions";
import type { DeskStay, FrontDesk, StayEventKind } from "@/lib/host/front-desk";
import type { StayMarksRead } from "@/lib/host/tape-chart-read";
import "./dashboard.css";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

type Words = Dictionary["hostDash"]["desk"];

/**
 * THE FRONT DESK (HOTEL-01): Arriving today, In house, Leaving today, each row
 * with one button, Check in or Check out.
 *
 * The buttons call `record_stay_event` through `markStay`, under the host's own
 * session. What happens next is only ever what the database said:
 *
 *   ok             the time of the mark replaces the button ("In at 14:05").
 *                  A second tap returns the first time, so it reads the same.
 *   not_available  the migration is not on the database yet. A calm sentence,
 *                  nothing changed, never a success.
 *   anything else  the database's own refusal, in a plain sentence.
 *
 * When the marks themselves cannot be read (`marks.state !== "ok"`) the
 * buttons are off and a note says why, so no tap can pretend to work.
 */

const GROUPS = [
  { key: "arriving", title: "arriving", empty: "emptyArriving", kind: "checked_in" },
  { key: "inHouse", title: "inHouse", empty: "emptyInHouse", kind: "checked_out" },
  { key: "leaving", title: "leaving", empty: "emptyLeaving", kind: "checked_out" },
] as const;

export function FrontDeskPanel({
  desk,
  marks,
  words,
  locale,
  limit,
  columns = false,
  showHotel = false,
  moreHref = "/host/bookings",
  headingAs: Heading = "h2",
}: {
  desk: FrontDesk;
  marks: StayMarksRead["state"];
  words: Words;
  locale: Locale;
  /** Rows shown per list; the rest are one tap away. Omitted, every row is drawn. */
  limit?: number;
  /** Three lists side by side from 1024px (the host home); stacked otherwise. */
  columns?: boolean;
  /** Name the hotel on each row; only when the host has more than one. */
  showHotel?: boolean;
  moreHref?: string;
  headingAs?: "h2" | "h3";
}) {
  const tag = locale === "en" ? "en-NG" : locale;
  const time = useMemo(
    () => new Intl.DateTimeFormat(tag, { hour: "numeric", minute: "2-digit", timeZone: "Africa/Lagos" }),
    [tag],
  );
  const dayLong = useMemo(
    () => new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }),
    [tag],
  );
  const dateOf = (day: string) => dayLong.format(new Date(`${day}T12:00:00Z`));

  const [pending, startTransition] = useSafeTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Record<string, string>>({});

  const live = marks === "ok";

  const mark = (id: string, kind: StayEventKind) => {
    setBusy(id);
    setFailed((now) => {
      const { [id]: _gone, ...rest } = now;
      return rest;
    });
    startTransition(async () => {
      const result = await markStay({ bookingId: id, kind });
      if (result.ok) setDone((now) => ({ ...now, [`${id}:${kind}`]: result.at }));
      else setFailed((now) => ({ ...now, [id]: words.errors[result.reason] }));
      setBusy(null);
    });
  };

  const rowSub = (stay: DeskStay, group: (typeof GROUPS)[number]["key"]) => {
    const parts: string[] = [showHotel ? words.roomLine.replace("{room}", stay.room).replace("{hotel}", stay.hotel) : stay.room];
    if (stay.rooms > 1) parts.push(countOf(stay.rooms, "rooms", locale));
    if (group !== "leaving") parts.push(words.leavesOn.replace("{date}", dateOf(stay.checkOut)));
    return parts.join(" · ");
  };

  return (
    <div className="nf-fd" data-testid="front-desk">
      <div className="nf-dash__head">
        <Heading className="nf-dash__title">{words.title}</Heading>
        <p className="nf-dash__lede">{words.lede}</p>
      </div>
      {!live ? (
        <p className="nf-fd__note" role="status" data-testid="front-desk-note">
          {marks === "missing" ? words.notAvailable : words.unreadable}
        </p>
      ) : null}
      <div className={["nf-fd__lists", columns ? "nf-fd__lists--cols" : ""].filter(Boolean).join(" ")}>
        {GROUPS.map((group) => {
          const rows = desk[group.key];
          const shown = limit ? rows.slice(0, limit) : rows;
          const hidden = rows.length - shown.length;
          return (
            <section key={group.key} className="nf-list-section" aria-label={words[group.title]} data-testid={`front-desk-${group.key}`}>
              <div className="nf-list-section__head">
                <h3 className="nf-section-label">
                  {words[group.title]} <span className="nf-numeric">{rows.length}</span>
                </h3>
              </div>
              {rows.length === 0 ? (
                <p className="nf-list-group nf-fd__empty">{words[group.empty]}</p>
              ) : (
                <ul className="nf-list-group">
                  {shown.map((stay) => {
                    const name = stay.guestName ?? words.guest;
                    const markedNow = done[`${stay.id}:${group.kind}`];
                    const markedAt = group.kind === "checked_in" ? (markedNow ?? stay.checkedInAt) : (markedNow ?? stay.checkedOutAt);
                    const inAt = group.key !== "arriving" ? stay.checkedInAt : null;
                    return (
                      <li key={stay.id} className="nf-list-item" data-testid="front-desk-row">
                        <div className="nf-list-row nf-list-row--two nf-fd__row">
                          <span className="nf-list-row__lead">
                            <InitialsTile name={name} />
                          </span>
                          <span className="nf-list-row__text">
                            <span className="nf-list-row__title">{name}</span>
                            <span className="nf-list-row__sub">{rowSub(stay, group.key)}</span>
                            <span className="nf-list-row__sub nf-fd__sub">
                              {inAt ? <span className="nf-numeric">{words.checkedInAt.replace("{time}", time.format(new Date(inAt)))}</span> : null}
                              {stay.late ? (
                                <StatusPill tone="warning" size="xs">
                                  {(group.key === "arriving" ? words.lateArrival : words.lateLeaving).replace(
                                    "{date}",
                                    dateOf(group.key === "arriving" ? stay.checkIn : stay.checkOut),
                                  )}
                                </StatusPill>
                              ) : null}
                              {stay.paid === false ? (
                                <StatusPill tone="warning" size="xs">
                                  {words.awaitingPayment}
                                </StatusPill>
                              ) : null}
                            </span>
                          </span>
                          <span className="nf-list-row__trail">
                            {markedAt ? (
                              <span className="nf-fd__done" data-testid="front-desk-marked">
                                {(group.kind === "checked_in" ? words.checkedInAt : words.checkedOutAt).replace(
                                  "{time}",
                                  time.format(new Date(markedAt)),
                                )}
                              </span>
                            ) : (
                              <Button
                                variant={group.kind === "checked_in" ? "primary" : "secondary"}
                                size="sm"
                                disabled={!live || pending}
                                loading={busy === stay.id}
                                onClick={() => mark(stay.id, group.kind)}
                                data-testid={group.kind === "checked_in" ? "check-in" : "check-out"}
                              >
                                {group.kind === "checked_in" ? words.checkIn : words.checkOut}
                              </Button>
                            )}
                          </span>
                          {failed[stay.id] ? (
                            <span className="nf-fd__error" role="alert">
                              {failed[stay.id]}
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {hidden > 0 ? (
                <Link href={moreHref} className="nf-fd__more nf-tap">
                  {plural(hidden, words.more, locale)}
                </Link>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
