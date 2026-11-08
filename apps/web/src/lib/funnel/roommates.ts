import "server-only";

import { cookies } from "next/headers";

import { getLocale } from "@/lib/locale";
import { requestSurface } from "@/lib/auth/surface";
import { createClient } from "@/lib/supabase/server";

import { isVisitId, VISIT_COOKIE } from "./steps";

/**
 * VALLO ROOMMATES' FUNNEL (8 November 2026), through the same first-party
 * table and function as the front door (`public.record_funnel_event`). The
 * payload is the step, a visit id, the language and the surface: no person,
 * no listing, no amount. Each account counts once per step (the table's
 * unique index), which is what a funnel asks: how many people got this far.
 *
 * Until the roommate SQL widens `funnel_events.step` and stamps the account
 * for these steps, the database drops them (its `check_violation` handler),
 * so this never errors and never holds a page or a write.
 */
export const ROOMMATES_FUNNEL_STEPS = [
  "roommates_home_view",
  "roommates_profile_live",
  "roommates_interest_sent",
  "roommates_interest_accepted",
  "roommates_chat_opened",
  "roommates_listing_published",
  "roommates_viewing_requested",
  "roommates_group_created",
] as const;
export type RoommatesFunnelStep = (typeof ROOMMATES_FUNNEL_STEPS)[number];

export async function recordRoommatesStep(step: RoommatesFunnelStep): Promise<void> {
  try {
    const visit = (await cookies()).get(VISIT_COOKIE)?.value;
    const visitId = isVisitId(visit) ? visit : crypto.randomUUID();
    const [locale, surface, supabase] = await Promise.all([getLocale(), requestSurface(), createClient()]);
    await supabase.rpc("record_funnel_event" as never, {
      p_step: step,
      p_visit: visitId,
      p_locale: locale,
      p_surface: surface === "ios-native" ? "ios" : surface === "android-native" ? "android" : "web",
      p_door: null,
    } as never);
  } catch {
    /* A funnel row is never worth an error. */
  }
}
