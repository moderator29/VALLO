"use client";

import { useActionState, useEffect, useState } from "react";
import type { Dictionary } from "@vallo/i18n/core";
import { useRouter } from "next/navigation";
import { cancel } from "@/lib/bookings/actions";
import type { ActionResult } from "@/lib/actions/envelope";
import type { BookingView } from "@/lib/bookings/queries";
import { UiIcon } from "@/design-system/icons/UiIcon";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmPanel } from "@/components/app/confirm/ConfirmPanel";

/**
 * CANCELLING A STAY. ONE DEFINITION, BOTH SURFACES.
 *
 * This was a private function inside `app/(app)/bookings/MyBookings.tsx`, which
 * was fine while `/bookings` was the only screen that listed a stay. `/trips`
 * is the Stays side's diary of the same stays, and when it moved to the date
 * spine it had no way to call one off: a guest looking at their own booking on
 * the side of the product that owns stays could see it and not cancel it.
 *
 * The rule the platform applies to this is that a capability is never lost to
 * gain a layout, and the rule this file exists for is that there is exactly ONE
 * cancel flow. Two copies of a confirm-then-write sheet is how one of them ends
 * up with a fix the other never gets, on the control that releases somebody's
 * dates and their money.
 *
 * `<Sheet>` owns the portal, the drag handle, the detents, the focus trap,
 * focus restoration, Escape, the backdrop and the body scroll lock. What is
 * left here is the decision: the server action, the refusal, and the success
 * state. On success the router refreshes and the server-rendered list becomes
 * the single source of truth, never optimistic guesswork.
 */
/** The sheet's words (`memberFlows.cancelBooking`). */
export type CancelBookingWords = Dictionary["memberFlows"]["cancelBooking"];

export function CancelBookingSheet({
  booking,
  onClose,
  words: w,
}: {
  booking: BookingView;
  onClose: () => void;
  words: CancelBookingWords;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<ActionResult<null> | null, FormData>(
    cancel,
    null,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  const cancelled = Boolean(state?.ok);

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={w.title}
      /* The success state speaks for itself and the confirm panel carries its
         own title; the title stays on as the sheet's accessible name. */
      hideTitle
      /* Cancelled: one Done under the result. Still asking: the confirm panel
         (plan item 22) carries its own foot, with the same form, the same
         hidden field and the same `cancel` action as before. */
      footer={
        cancelled ? (
          <Button variant="primary" full onClick={onClose}>
            {w.done}
          </Button>
        ) : undefined
      }
    >
      {cancelled ? (
        <div className="text-center">
          <p className="flex items-center justify-center gap-xs text-[length:var(--nf-text-body-lg)] font-semibold text-[var(--nf-content-primary)]">
            <UiIcon name="verified" size={20} className="text-[var(--nf-state-success)]" />
            {w.cancelledTitle}
          </p>
          <p className="mt-xs text-[length:var(--nf-text-body-sm)] leading-relaxed text-[var(--nf-content-secondary)]">
            {w.cancelledBody.replace("{title}", booking.title).replace("{dates}", booking.dateRange)}
          </p>
        </div>
      ) : (
        <ConfirmPanel
          icon="calendar-booking"
          tone="error"
          title={w.title}
          context={w.context}
          summary={[
            { label: w.stay, value: booking.title },
            { label: w.dates, value: booking.dateRange },
            { label: w.total, value: booking.totalDisplay },
          ]}
          next={[{ icon: "calendar-check", text: w.released }]}
          error={state && !state.ok ? state.error : null}
          cancel={
            <Button variant="secondary" onClick={onClose}>
              {w.keep}
            </Button>
          }
          primary={
            <form action={formAction}>
              <input type="hidden" name="bookingId" value={booking.id} />
              <Button type="submit" variant="primary" loading={pending}>
                {w.confirm}
              </Button>
            </form>
          }
        />
      )}
    </Sheet>
  );
}

/**
 * The trigger and the sheet together, as one client island.
 *
 * `/bookings` lifts the open state to its list, because one sheet serves a
 * tab of cards and the card that opened it is already known. `/trips` renders
 * its spine on the server, so a row there cannot hold state; this is the small
 * island it drops in instead. Both end up at the same sheet above, which is
 * the whole point of the file.
 */
export function CancelBookingControl({
  booking,
  label,
  words,
}: {
  booking: BookingView;
  /** The opener's word; `words.open` when absent. */
  label?: string;
  words: CancelBookingWords;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="quiet" size="sm" onClick={() => setOpen(true)}>
        {label ?? words.open}
      </Button>
      {open && <CancelBookingSheet booking={booking} onClose={() => setOpen(false)} words={words} />}
    </>
  );
}
