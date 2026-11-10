import "server-only";

import type { JobVerdict } from "../../bookings/lifecycle";
import { callServiceFunction, type AdminClient } from "../rpc";

/**
 * OFFERS, HOURLY. Expires sale offers that reached their date (both sides are
 * told, the agreement is logged) and reminds the side whose answer has waited
 * longer than the policy's hours, once per window. Both are definer functions
 * (`sale_offers_expire_due`, `sale_offers_remind_due`) so the work is
 * transactional and skips rows another run holds.
 */
export async function offersSweep(admin: AdminClient): Promise<JobVerdict> {
  const expired = (await callServiceFunction(admin, "sale_offers_expire_due", {})) as { expired?: number } | null;
  const reminded = (await callServiceFunction(admin, "sale_offers_remind_due", {})) as { reminded?: number } | null;
  return {
    outcome: "ok",
    counts: { expired: Number(expired?.expired ?? 0), reminded: Number(reminded?.reminded ?? 0) },
    detail: {},
    alert: null,
  };
}
