"use client";

import Link from "next/link";
import type { Dictionary, Locale } from "@vallo/i18n/core";
import { lagosWhen } from "@/components/app/threads/when";
import { ButtonLink } from "@/components/ui/Button";
import { AuthGate } from "@/components/auth/AuthGate";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { TYPE } from "@/components/app/Screen";
import type { Inspection } from "@/lib/inspections/types";

/**
 * ASKING TO SEE A PROPERTY: THE DOOR INTO SCHEDULE A VISIT.
 *
 * This used to be a sheet with a date-and-time input of its own, a second
 * way to ask for the same thing the listing's viewing slots booked. There is
 * one way now, the two-step flow at `/listing/[id]/visit`: it books an open
 * time the lister set, or files a suggested time the lister confirms, both
 * through the same server actions this sheet called (`bookViewingSlot`,
 * `requestInspection`, now carrying the visit mode). So this is the button
 * into it, and nothing else.
 *
 * MESSAGING IS NOT REPLACED. It sits beside this, and it should: an inspection
 * needs a conversation around it.
 *
 * ALREADY ASKED IS ITS OWN STATE. With a live visit of this home, this says
 * where it stands, on Lagos time, and links to that visit's own status
 * screen, instead of offering to file another the action would refuse.
 */
export function RequestInspection({
  listingId,
  existing,
  locale,
  copy,
  zone,
}: {
  /** The door's words (`t.visit.entry`). */
  copy: Dictionary["visit"]["entry"];
  /** "Lagos time" (`t.visit.tiles.lagos`). */
  zone: string;
  listingId: string;
  /** An open request this person already has against this property, if any. */
  existing: Inspection | null;
  locale: Locale;
}) {
  if (existing) {
    /* The day AND the hour, on Lagos time, said as such: "on Sat 17 Oct"
       alone left a renter to find the hour on another screen. */
    const shown = lagosWhen(existing.slotAt ?? existing.requestedAt, locale);

    return (
      <p className={`flex items-start gap-xs ${TYPE.rowMeta}`} data-testid="inspection-existing">
        <UiIcon name="calendar-booking" size={20} className="mt-3xs shrink-0" />
        <span>
          {shown
            ? `${(existing.state === "CONFIRMED"
                ? copy.confirmedFor
                : existing.state === "PROPOSED"
                  ? copy.offered
                  : copy.askedFor
              )
                .replace("{when}", shown)
                .replace("{zone}", zone)} `
            : null}
          <Link href={`/listing/${listingId}/visit/${existing.id}`} className="underline" data-testid="inspection-existing-link">
            {copy.track}
          </Link>
        </span>
      </p>
    );
  }

  return (
    /* Requesting an inspection is one of the gated actions, so a guest gets
       the door carrying the screen they were standing on. */
    <AuthGate action="inspect">
      <ButtonLink
        href={`/listing/${listingId}/visit`}
        full
        variant="secondary"
        leadingIcon="calendar-booking"
        data-testid="request-inspection"
      >
        {copy.ask}
      </ButtonLink>
    </AuthGate>
  );
}
