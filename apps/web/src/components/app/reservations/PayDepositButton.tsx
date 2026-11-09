"use client";

import { banner } from "@/lib/ui/toast";
import { PhoneGateLink } from "@/components/app/PhoneGateLink";
import { isPhoneGate } from "@/lib/actions/envelope";
import { useState } from "react";
import { payReservationDeposit } from "@/lib/reservations/deposit-actions";
import { Button } from "@/components/ui/Button";
import { useSafeTransition } from "@/lib/ui/use-safe-transition";
import { tapFailedOffline } from "@/lib/offline/tap-failed";

/**
 * D75: pay a restaurant's table deposit, by card. Opens Paystack's hosted
 * checkout; the webhook and the return page (never this button) record it
 * as paid. The words are the caller's, in the reader's language.
 */
export function PayDepositButton({
  reservationId,
  label,
  pendingLabel,
  size = "sm",
  full = false,
}: {
  reservationId: string;
  label: string;
  /** Said while the payment page is being opened. Defaults to the label. */
  pendingLabel?: string;
  size?: "sm" | "md" | "lg";
  full?: boolean;
}) {
  const [phoneGate, setPhoneGate] = useState(false);
  const [pending, start] = useSafeTransition();
  /* Stays set once the checkout address is on its way, so a second tap cannot open a second checkout. */
  const [redirecting, setRedirecting] = useState(false);
  return (
    <span className={`${full ? "flex w-full" : "inline-flex"} flex-col gap-inline`}>
      <Button
        type="button"
        variant="primary"
        size={size}
        full={full}
        disabled={pending || redirecting}
        loading={pending || redirecting}
        data-testid="trip-pay-deposit"
        onClick={() =>
          start(async () => {
            try {
              setPhoneGate(false);
              const result = await payReservationDeposit(reservationId);
              if (!result.ok) {
                /* Said by the one banner (Grade 1); the phone step stays as its link. */
                banner.error(result.error);
                setPhoneGate(isPhoneGate(result));
                return;
              }
              setRedirecting(true);
              window.location.assign(result.data.authorizationUrl);
            } catch (error) {
              if (!tapFailedOffline(error)) throw error;
            }
          })
        }
      >
        {pending || redirecting ? (pendingLabel ?? label) : label}
      </Button>
      <PhoneGateLink show={phoneGate} full />
    </span>
  );
}
