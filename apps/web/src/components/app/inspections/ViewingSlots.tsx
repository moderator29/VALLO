"use client";

import { useState } from "react";
import { formatDate, type Dictionary, type Locale } from "@vallo/i18n/core";
import { ButtonLink } from "@/components/ui/Button";
import { Chip, ChipRow } from "@/components/ui/Chip";
import { slotsByDay, type Slot } from "@/lib/viewings/route";
import type { SuccessWords } from "@/lib/ui/success-moments";

/**
 * V-94: THE LISTER'S OPEN VIEWING TIMES, AS A PREVIEW ON THE LISTING.
 *
 * The free slots by day; a tap chooses a time, and the button opens Schedule
 * a visit (`/listing/[id]/visit?slot=`) with that time already picked. The
 * booking itself happens there, in one place, through the same action this
 * panel used to call (`bookViewingSlot`, which writes it CONFIRMED), after
 * the renter has chosen how to visit and seen what they are booking. Its
 * status screen is the confirmation, so this panel no longer opens a sheet of
 * its own. The page draws this only when the listing has free slots.
 */

type Copy = Dictionary["frontDoor"]["viewings"];


function when(iso: string, locale: Locale, withDay: boolean): string {
  return formatDate(new Date(iso), locale, {
    ...(withDay ? { weekday: "short", day: "numeric", month: "short" } : {}),
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

function dayLabel(day: string, locale: Locale): string {
  return formatDate(new Date(`${day}T12:00:00+01:00`), locale, { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" });
}

export function ViewingSlots({
  listingId,
  slots,
  copy,
  locale,
}: {
  listingId: string;
  slots: Slot[];
  copy: Copy;
  locale: Locale;
  /**
   * The page's `t.success`. Accepted and no longer drawn here: the booking
   * moved into Schedule a visit, whose status screen is the moment.
   */
  success?: SuccessWords;
}) {
  const days = slotsByDay(slots);
  const [day, setDay] = useState(days[0]?.day ?? "");
  const [chosen, setChosen] = useState<string | null>(null);
  const current = days.find((d) => d.day === day) ?? days[0];

  return (
    <section className="nf-panel nf-panel--card p-card-sm" data-testid="viewing-slots" aria-live="polite">
      <h2 className="nf-body font-semibold text-[var(--nf-content-primary)]">{copy.pickTitle}</h2>
      {/* The chips print bare hours, so whose clock they are on is said
          once here: a renter abroad would otherwise read them as their own. */}
      <p className="mt-inline nf-caption text-[var(--nf-content-muted)]">
        {copy.pickNote} {copy.lagosNote}
      </p>
      <nav aria-label={copy.pickTitle} className="mt-row">
        <ChipRow bleed={false}>
          {days.map((d) => (
            <Chip key={d.day} size="sm" selected={d.day === current?.day} onSelectedChange={() => { setDay(d.day); setChosen(null); }}>
              {dayLabel(d.day, locale)}
            </Chip>
          ))}
        </ChipRow>
      </nav>
      <div className="mt-row flex flex-wrap gap-xs" role="radiogroup" aria-label={copy.pickTitle}>
        {current?.slots.map((slot) => (
          <Chip
            key={slot.slotAt}
            size="sm"
            behaviour="choice"
            selected={chosen === slot.slotAt}
            onSelectedChange={() => setChosen(slot.slotAt)}
            data-testid="viewing-slot"
          >
            {when(slot.slotAt, locale, false)}
          </Chip>
        ))}
      </div>
      {chosen && (
        <ButtonLink
          href={`/listing/${listingId}/visit?slot=${encodeURIComponent(chosen)}`}
          variant="primary"
          full
          className="mt-row"
          data-testid="viewing-slot-continue"
        >
          {copy.book.replace("{time}", when(chosen, locale, true))}
        </ButtonLink>
      )}
    </section>
  );
}
