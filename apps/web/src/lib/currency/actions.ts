"use server";

import { cookies } from "next/headers";
import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { resolveSession } from "@/lib/actions/session";
import { isCurrencyChoice } from "./currencies";
import { isAreaUnit } from "./area";
import { AREA_COOKIE, CURRENCY_COOKIE, PREFERENCE_COOKIE_MAX_AGE, withDisplay } from "./preference";

/**
 * Save the reader's currency and floor-area unit (Settings, Language and
 * currency). Always on this device, as two cookies the server reads before it
 * renders; and, signed in, on the account (`profiles.settings.display`) so
 * every device and both app shells give the same answer.
 *
 * The account write keeps every other key in the settings document exactly
 * as stored. Signed in, a failed account write is reported (the device still
 * switched), because the account is what another device will read.
 */
export async function saveDisplayPreferences(input: {
  currency: string;
  areaUnit: string;
}): Promise<ActionResult<{ onAccount: boolean }>> {
  const currency = input?.currency;
  const areaUnit = input?.areaUnit;
  if (!isCurrencyChoice(currency) || !isAreaUnit(areaUnit)) {
    return fail("That choice is not on the list. Pick again.");
  }

  const jar = await cookies();
  const cookie = { secure: true, sameSite: "lax" as const, path: "/", maxAge: PREFERENCE_COOKIE_MAX_AGE, httpOnly: true };
  jar.set(CURRENCY_COOKIE, currency, cookie);
  jar.set(AREA_COOKIE, areaUnit, cookie);

  const session = await resolveSession();
  if (session.state !== "signed-in") return ok({ onAccount: false });

  const { data, error: readError } = await session.supabase
    .from("profiles")
    .select("settings")
    .eq("id", session.user.id)
    .maybeSingle();
  if (readError || !data) return fail("Saved on this device. We could not save it to your account, so try again.");
  const { error } = await session.supabase
    .from("profiles")
    .update({ settings: withDisplay(data.settings, { currency, areaUnit }) as never })
    .eq("id", session.user.id);
  if (error) return fail("Saved on this device. We could not save it to your account, so try again.");
  return ok({ onAccount: true });
}
