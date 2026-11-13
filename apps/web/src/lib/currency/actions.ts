"use server";

import { cookies } from "next/headers";
import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { resolveSession } from "@/lib/actions/session";
import { AUTO_CURRENCY, isCurrencyChoice } from "./currencies";
import { DEFAULT_AREA_UNIT, isAreaUnit } from "./area";
import {
  AREA_COOKIE,
  CURRENCY_COOKIE,
  PREFERENCE_COOKIE_MAX_AGE,
  displayFromSettings,
  withDisplay,
} from "./preference";

/**
 * Save the reader's currency and/or floor-area unit (Settings, Language and
 * currency). Always on this device, as two cookies the server reads before it
 * renders; and, signed in, on the account (`profiles.settings.display`) so
 * every device and both app shells give the same answer.
 *
 * Either field may be sent alone; the other keeps what is stored (the
 * account's, else this device's), so two quick changes on two rows cannot
 * undo each other. The account write keeps every other key in the settings
 * document exactly as stored. Signed in, a failed account write is reported
 * (the device still switched), because the account is what another device
 * will read.
 */
export async function saveDisplayPreferences(input: {
  currency?: string;
  areaUnit?: string;
}): Promise<ActionResult<{ onAccount: boolean }>> {
  const asked = { currency: input?.currency, areaUnit: input?.areaUnit };
  if (asked.currency === undefined && asked.areaUnit === undefined) return fail("Nothing to save. Pick a choice first.");
  if (asked.currency !== undefined && !isCurrencyChoice(asked.currency)) return fail("That choice is not on the list. Pick again.");
  if (asked.areaUnit !== undefined && !isAreaUnit(asked.areaUnit)) return fail("That choice is not on the list. Pick again.");

  const jar = await cookies();
  const session = await resolveSession();

  let settings: unknown = null;
  if (session.state === "signed-in") {
    const { data, error } = await session.supabase.from("profiles").select("settings").eq("id", session.user.id).maybeSingle();
    if (!error && data) settings = data.settings;
  }
  const stored = displayFromSettings(settings);
  const cookieCurrency = jar.get(CURRENCY_COOKIE)?.value;
  const cookieArea = jar.get(AREA_COOKIE)?.value;
  const next = {
    currency: isCurrencyChoice(asked.currency)
      ? asked.currency
      : (stored.currency ?? (isCurrencyChoice(cookieCurrency) ? cookieCurrency : AUTO_CURRENCY)),
    areaUnit: isAreaUnit(asked.areaUnit)
      ? asked.areaUnit
      : (stored.areaUnit ?? (isAreaUnit(cookieArea) ? cookieArea : DEFAULT_AREA_UNIT)),
  };

  const cookie = { secure: true, sameSite: "lax" as const, path: "/", maxAge: PREFERENCE_COOKIE_MAX_AGE, httpOnly: true };
  jar.set(CURRENCY_COOKIE, next.currency, cookie);
  jar.set(AREA_COOKIE, next.areaUnit, cookie);

  if (session.state !== "signed-in") return ok({ onAccount: false });
  if (settings === null) return fail("Saved on this device. We could not save it to your account, so try again.");

  const { error } = await session.supabase
    .from("profiles")
    .update({ settings: withDisplay(settings, next) as never })
    .eq("id", session.user.id);
  if (error) return fail("Saved on this device. We could not save it to your account, so try again.");
  return ok({ onAccount: true });
}
