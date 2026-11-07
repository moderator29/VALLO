"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { decideReservationAsAdmin } from "@/lib/admin/bookings-actions";
import type { ReservationDecision } from "@/lib/admin/schema";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";
import { banner } from "@/lib/ui/toast";

/**
 * The three things an operator can do to a table, and the sentence first.
 *
 * Confirm and decline are the host's own answers taken on their behalf, so a
 * request that has sat unanswered gets one. Cancel is the platform calling a
 * confirmed table off. The two that take a table away ask for a reason
 * before the button, because the guest reads it word for word, and the
 * confirmation names the guest and the place so nobody confirms a button
 * rather than a decision.
 */

const WORDS: Record<ReservationDecision, { verb: string; consequence: string }> = {
  confirm: {
    verb: "Confirm the table",
    consequence:
      "The reservation moves to confirmed on the restaurant's behalf and the guest is told it is on.",
  },
  decline: {
    verb: "Decline the request",
    consequence:
      "The request is cancelled on the restaurant's behalf. The guest is told, with your reason, and nothing is charged.",
  },
  cancel: {
    verb: "Cancel the table",
    consequence:
      "The confirmed table is cancelled by Vallo. The guest is told, with your reason, and nothing is charged.",
  },
};

export function ReservationDecisions({
  reservationId,
  guestName,
  placeName,
  offers,
}: {
  reservationId: string;
  guestName: string;
  placeName: string;
  /** Which decisions this row can take, from its status and its clock. */
  offers: ReservationDecision[];
}) {
  const router = useRouter();
  const [chosen, setChosen] = useState<ReservationDecision | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useSafeTransition();

  if (offers.length === 0) return null;

  const needsReason = chosen !== null && chosen !== "confirm";
  const reasonReady = !needsReason || reason.trim().length >= 10;

  function run() {
    if (!chosen) return;
    setError(null);
    start(async () => {
      try {
        const result = await decideReservationAsAdmin({
          reservationId,
          decision: chosen,
          reason: reason.trim(),
        });
        if (!result.ok) {
          const about = result.fieldErrors?.["reason"];
          if (about) setError(about);
          else banner.error(result.error, { retry: run });
          return;
        }
        setDone(true);
        banner.success(
          chosen === "confirm"
            ? "Confirmed. The guest has been told."
            : "Cancelled. The guest has been told, with your reason, and the decision is in the audit log.",
        );
        setChosen(null);
        setReason("");
        router.refresh();
      } catch (error) {
        if (!tapFailedOffline(error)) throw error;
      }
    });
  }

  /* Decided: the banner says so and the refresh redraws the booking. */
  if (done) return null;

  return (
    <div className="mt-sm">
      {chosen === null ? (
        <div className="flex flex-wrap gap-inline">
          {offers.includes("confirm") && (
            <Button type="button" size="sm" onClick={() => setChosen("confirm")}>
              Confirm for the restaurant
            </Button>
          )}
          {offers.includes("decline") && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => setChosen("decline")}
            >
              Decline for the restaurant
            </Button>
          )}
          {offers.includes("cancel") && (
            <Button
              type="button"
              size="sm"
              variant="dangerQuiet"
              onClick={() => setChosen("cancel")}
            >
              Cancel this table
            </Button>
          )}
        </div>
      ) : (
        /* THE CONFIRM PANEL IS A CONTAINER, SO ITS EDGE IS LIT GLASS.
           It carried `border border-[var(--nf-border-subtle)]`, a flat grey
           outline, which is a box from a different company by the founder's
           ruling on container edges. `nf-card` is the platform's one pane:
           the blue conic rim that catches where the light enters and leaves,
           the inner catchlight, the elevation rung. No new class, no second
           material for the one panel that takes a table away. */
        <div className="nf-panel nf-panel--card nf-admin-card p-card-sm">
          <p className="nf-body font-semibold text-content">
            {WORDS[chosen].verb} for {guestName} at {placeName}?
          </p>
          <p className="nf-body-sm mt-row text-content-2">{WORDS[chosen].consequence}</p>

          {needsReason && (
            <label className="mt-row block">
              <span className="nf-label">Why</span>
              <textarea
                className="nf-field min-h-[72px] resize-y"
                value={reason}
                maxLength={500}
                onChange={(event) => setReason(event.target.value)}
                placeholder="The guest reads this word for word, so keep it specific and kind."
              />
            </label>
          )}

          <div className="mt-row flex flex-wrap gap-inline">
            <Button
              type="button"
              size="sm"
              variant={chosen === "confirm" ? "primary" : "danger"}
              loading={pending}
              disabled={!reasonReady}
              onClick={run}
            >
              {WORDS[chosen].verb}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setChosen(null);
                setError(null);
              }}
            >
              Not now
            </Button>
          </div>
          {error && (
            <p role="alert" className="nf-body-sm mt-row font-semibold text-[var(--nf-state-error)]">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
