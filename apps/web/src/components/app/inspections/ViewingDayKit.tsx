"use client";

import { banner } from "@/lib/ui/toast";
import { useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { sendMessage } from "@/lib/messages/actions";
import { sendOrKeep } from "@/lib/offline/send-or-keep";
import {
  dayOfViewing,
  icsFileName,
  LATE_OPTIONS,
  lateMessage,
  viewingAhead,
  viewingIcs,
  type LateMinutes,
} from "@/lib/viewings/day-kit";

/**
 * B5: THE VIEWING DAY KIT, on a CONFIRMED inspection.
 *
 *   Add to calendar   an .ics made on this device (area and state only, a
 *                     link back, a 90 minute alarm). Nothing is sent anywhere.
 *   On the day        "On my way" and "Running late" (15, 30 or 60 minutes)
 *                     send a fixed, prewritten message into the inspection's
 *                     own conversation through the outbox (`sendOrKeep`), so a
 *                     tap on an okada with one bar still leaves: with no
 *                     signal the message is kept and sends itself later.
 *
 * Reminders are server side (the pending reminders migration); this is the
 * part a person taps. The requester and the lister both get it: running late
 * is a thing either side can be.
 */
export function ViewingDayKit({
  inspectionId,
  slotAt,
  area,
  place,
  conversationId,
  copy,
  now,
}: {
  inspectionId: string;
  slotAt: string | null;
  /** The area alone, for the calendar title. */
  area: string;
  /** Area and state (or city), for the calendar location. Never a street. */
  place: string;
  conversationId: string | null;
  copy: Dictionary["memberKit"]["dayKit"];
  /** The render's clock, so a test can pin the day. */
  now?: number;
}) {
  /* Read once, when the kit mounts: the strip does not tick. */
  const [clock] = useState(() => now ?? Date.now());
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!viewingAhead(slotAt, clock)) return null;
  const today = dayOfViewing(slotAt, clock);

  function addToCalendar() {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const ics = viewingIcs({
      inspectionId,
      slotAt: slotAt!,
      title: copy.calendarTitle.replace("{area}", area),
      location: place,
      url: `${origin}/bookings?kind=inspection#ix-${inspectionId}`,
      alarm: copy.calendarAlarm,
    });
    if (!ics) return;
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = icsFileName(area);
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  /* What a message did is said by the one banner at the top of the screen
     (Grade 1): sent, kept on the phone for later, or not sent. */
  async function send(body: string) {
    if (!conversationId) {
      banner.info(copy.noThread);
      return;
    }
    setBusy(true);
    try {
      const done = await sendOrKeep("send_message", { conversationId, body }, (tapKey) =>
        sendMessage({ conversationId, body, tapKey }),
      );
      if (done.state === "kept") banner.info(copy.kept);
      else if (done.state === "sent" && done.result.ok) banner.success(copy.sent);
      else banner.error(copy.failed, { retry: () => void send(body) });
    } catch {
      banner.error(copy.failed, { retry: () => void send(body) });
    } finally {
      setBusy(false);
      setAsking(false);
    }
  }

  const calendar = (
    <Button variant="secondary" size="sm" leadingIcon="calendar-booking" onClick={addToCalendar} data-testid="day-kit-calendar">
      {copy.addToCalendar}
    </Button>
  );

  return (
    <section className="nf-day-kit" aria-label={copy.label} data-testid="viewing-day-kit">
      {!today ? (
        /* Before the day: the one thing worth doing is the calendar. */
        <div className="nf-day-kit__row">{calendar}</div>
      ) : asking ? (
        /* How late, in place of the day's buttons: three equal choices and a
           way back, never two rows of buttons at once. */
        <div className="nf-day-kit__late" role="group" aria-label={copy.lateAsk}>
          <div className="nf-day-kit__head">
            <span className="nf-day-kit__ask">{copy.lateAsk}</span>
            <Button variant="quiet" size="sm" disabled={busy} onClick={() => setAsking(false)}>
              {copy.cancel}
            </Button>
          </div>
          <div className="nf-day-kit__choices">
            {LATE_OPTIONS.map((m: LateMinutes) => (
              <Button
                key={m}
                variant="secondary"
                size="sm"
                full
                disabled={busy}
                onClick={() => void send(lateMessage(m, copy.lateMessage))}
                data-testid={`day-kit-late-${m}`}
              >
                {copy.lateChoice.replace("{minutes}", String(m))}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        /* On the day: the two messages lead, side by side where they fit and
           stacked full width where they do not; the calendar follows. */
        <>
          <div className="nf-day-kit__head">
            <StatusBadge tone="info" size="sm">
              {copy.dayOf}
            </StatusBadge>
          </div>
          <div className="nf-day-kit__pair">
            <Button variant="secondary" size="sm" full leadingIcon="location" disabled={busy} onClick={() => void send(copy.onMyWayMessage)} data-testid="day-kit-on-my-way">
              {copy.onMyWay}
            </Button>
            <Button variant="secondary" size="sm" full leadingIcon="clock" disabled={busy} onClick={() => setAsking(true)} data-testid="day-kit-late">
              {copy.runningLate}
            </Button>
          </div>
          <div className="nf-day-kit__row">
            <Button variant="quiet" size="sm" onClick={addToCalendar} data-testid="day-kit-calendar">
              {copy.addToCalendar}
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
