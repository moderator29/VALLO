"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { ConfirmPanel } from "@/components/app/confirm/ConfirmPanel";
import { acceptRoomRequest, declineRoomRequest } from "@/lib/host/room-booking-actions";
import { bookingAcceptedPreview } from "@/lib/email/everyone-gets";
import type { Dictionary } from "@vallo/i18n/core";
import { HOST_ROOM_GUEST_PAYS_NEXT, HOST_ROOM_TOTAL_LABEL, PAYOUT_ANSWER } from "@/lib/money/copy";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";

/** What the confirm panel names: the request as the row already shows it. */
export type RoomRequestSummary = {
  guestName: string;
  room: string;
  hotel: string;
  /** "Sat 4 Oct to Mon 6 Oct", as the row prints it. */
  dates: string;
  /** "2 nights · 2 guests". */
  stay: string;
  /** The total, formatted. */
  total: string;
  listingTitle: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalMinor: number;
};

/* The first sentence of the payout answer: where the host's share goes. */
const PAID_STRAIGHT = PAYOUT_ANSWER.split(". ")[0] + ".";

/**
 * Accept or decline one room request, each confirmed in the one confirm
 * panel (plan item 22). The actions, their validation and their messages are
 * exactly what they were: `acceptRoomRequest` and `declineRoomRequest`, the
 * optional reason for the guest capped at 500 characters. What changed is
 * that neither fires from the row any more; each opens the panel, which says
 * what is being answered, what happens next and what the guest receives.
 */
export function RoomRequestAnswer({
  bookingId,
  summary,
  words,
}: {
  bookingId: string;
  summary: RoomRequestSummary;
  /** The sheet's words in the reader's language, handed down by the page. */
  words: Dictionary["experienceHost"]["bookings"]["answer"];
}) {
  const [open, setOpen] = useState<"accept" | "decline" | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useSafeTransition();
  const router = useRouter();

  const run = (act: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const result = await act();
      if (!result.ok) setError(result.error ?? words.failed);
      else {
        setOpen(null);
        router.refresh();
      }
    });

  const first = summary.guestName.split(" ")[0] || summary.guestName;
  /* Accepting moves the booking to CONFIRMED, which the database tells the
     guest in the app (`private.notify_booking_change`). No email is sent from
     this action, so the preview keeps the app message and drops the email. */
  const everyone = bookingAcceptedPreview({
    guestName: summary.guestName,
    listingTitle: summary.listingTitle,
    checkIn: summary.checkIn,
    checkOut: summary.checkOut,
    nights: summary.nights,
    totalMinor: summary.totalMinor,
  })
    .filter((card) => card.push)
    .map((card) => ({ ...card, email: null, channel: "App" as const }));

  const facts = [
    { label: words.guest, value: summary.guestName },
    { label: words.dates, value: summary.dates },
    { label: words.room, value: summary.room },
  ];

  return (
    <div className="mt-xs grid gap-xs" data-testid="room-request-answer">
      <div className="flex flex-wrap gap-xs">
        <Button variant="primary" size="md" disabled={pending} onClick={() => setOpen("accept")}>
          {words.accept}
        </Button>
        <Button variant="secondary" size="md" disabled={pending} onClick={() => setOpen("decline")}>
          {words.decline}
        </Button>
      </div>

      <Sheet
        open={open !== null}
        onOpenChange={(next) => {
          if (!next && !pending) {
            setOpen(null);
            setError(null);
          }
        }}
        title={(open === "decline" ? words.declineTitle : words.acceptTitle).replace("{name}", first)}
        hideTitle
        card
        detents={[0.9]}
      >
        {open === "accept" ? (
          <ConfirmPanel
            icon="bed"
            title={words.acceptTitle.replace("{name}", first)}
            context={`${words.roomAt.replace("{room}", summary.room).replace("{hotel}", summary.hotel)} · ${summary.stay}`}
            summary={facts}
            total={{ label: HOST_ROOM_TOTAL_LABEL, amount: summary.total }}
            reassurance={PAID_STRAIGHT}
            next={[
              { icon: "file-text", text: words.nextAgreement },
              { icon: "shield-check", text: words.nextChecked },
              { icon: "credit-card", text: HOST_ROOM_GUEST_PAYS_NEXT },
            ]}
            everyone={everyone}
            told={words.told.replace("{name}", first)}
            error={error}
            cancel={
              <Button variant="secondary" size="md" disabled={pending} onClick={() => setOpen(null)}>
                {words.cancel}
              </Button>
            }
            primary={
              <Button
                variant="primary"
                size="md"
                loading={pending}
                disabled={pending}
                onClick={() => run(() => acceptRoomRequest(bookingId))}
              >
                {words.acceptBooking}
              </Button>
            }
          />
        ) : open === "decline" ? (
          <ConfirmPanel
            icon="circle-x"
            tone="error"
            title={words.declineTitle.replace("{name}", first)}
            context={`${words.roomAt.replace("{room}", summary.room).replace("{hotel}", summary.hotel)} · ${summary.stay}`}
            summary={facts}
            next={[{ icon: "calendar-check", text: words.nextNightsBack }]}
            told={words.told.replace("{name}", first)}
            error={error}
            cancel={
              <Button variant="secondary" size="md" disabled={pending} onClick={() => setOpen(null)}>
                {words.keepIt}
              </Button>
            }
            primary={
              <Button
                variant="secondary"
                size="md"
                loading={pending}
                disabled={pending}
                className="text-[var(--nf-state-error)]"
                onClick={() => run(() => declineRoomRequest(bookingId, reason.trim() || undefined))}
              >
                {words.declineRequest}
              </Button>
            }
          >
            <label className="grid gap-2xs">
              <span className="nf-caption">{words.why}</span>
              <textarea
                className="nf-field"
                rows={2}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                disabled={pending}
              />
            </label>
          </ConfirmPanel>
        ) : null}
      </Sheet>
    </div>
  );
}
