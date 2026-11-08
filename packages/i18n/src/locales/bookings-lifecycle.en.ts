/**
 * Booking lifecycle copy (SW11). Moved from:
 *   - lib/bookings/lifecycle.ts (NO_SHOW_MESSAGES)
 */

export const noShowMessagesEn = {
  already: "This stay is already recorded as a no show.",
  not_confirmed:
    "Only a confirmed stay can be recorded as a no show. Reload the page to see where this one stands.",
  not_arrived:
    "Arrival day has not come yet, so there is nothing to record. You can record a no show from 12:00 the day after check-in.",
  too_early:
    "A guest can still arrive late on the day. You can record a no show from 12:00 the day after check-in.",
  rent_charge:
    "A move-in is not recorded as a no show. If your tenant has not moved in, contact support and we will look into it.",
  missing: "We could not find that booking. Reload the page to see your current stays.",
};
