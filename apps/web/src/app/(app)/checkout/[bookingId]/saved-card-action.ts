"use server";

import { payWithSavedCard } from "@/lib/bookings/checkout";
import type { ActionResult } from "@/lib/actions/envelope";
import type { ChargeSavedCardOutcome } from "@/lib/payments/charge-saved-card";

/**
 * The saved-card charge, bound to one booking and one idempotency key by the
 * checkout page and handed to `PayPanel` as its `chargeSavedCard` prop.
 *
 * The page binds the first two arguments with `.bind`, so the panel only
 * names the card. Bound arguments are NOT encrypted (only an inline action's
 * closure is) and any exported action can be called with any arguments, so
 * nothing here is trusted: `payWithSavedCard` reads the booking under the
 * caller's session and refuses one they are not the guest of, reads the card
 * only from the caller's own saved cards, and takes the amount and split from
 * the database. The key only stops a double tap charging twice.
 */
export async function chargeSavedCardFor(
  bookingId: string,
  idempotencyKey: string,
  methodId: string,
): Promise<ActionResult<ChargeSavedCardOutcome>> {
  return payWithSavedCard({ bookingId, methodId, idempotencyKey });
}
