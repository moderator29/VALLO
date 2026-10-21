import "server-only";

import { flagIsOn } from "../flags/read";
import { isPaystackConfigured } from "../payments/paystack";

/**
 * PAYING A TABLE'S BILL THROUGH VALLO, AND THE ONE SWITCH IT SITS BEHIND.
 *
 * The founder's rule (HANDOFF section 2): bill payment stays off until the
 * Paystack keys and each restaurant's payout subaccount exist and the flow has
 * passed in Paystack test mode. Before this switch the only gate was the
 * Paystack key, which production has for stays, so a restaurant with a payout
 * subaccount was already open to bill payments.
 *
 * `restaurant_bill_pay` is fail-closed (`flagIsOn`): a missing row, a failed
 * read or no Supabase all read off. While off, no bill is entered, confirmed
 * or opened for payment, and the screens do not offer it. A bill whose
 * checkout was already opened still settles from the signed webhook and the
 * diner's return: money that moved is always recorded.
 *
 * To switch it on, after the Paystack test-mode run:
 *   insert into public.feature_flags (key, enabled) values ('restaurant_bill_pay', true)
 *   on conflict (key) do update set enabled = true;
 */
export const RESTAURANT_BILL_PAY_FLAG = "restaurant_bill_pay";

export async function billPayOn(): Promise<boolean> {
  if (!isPaystackConfigured()) return false;
  return flagIsOn(RESTAURANT_BILL_PAY_FLAG);
}
