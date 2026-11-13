"use server";

/**
 * The restaurant saves its table deposit settings (track/restaurant-deposits).
 *
 * THROUGH THE PATH THAT EXISTS. d75a gave the owner the writes under RLS
 * (`restaurant_deposit_rules_owner_insert` and `_owner_update`, both
 * `private.owns_business`), and its trigger refuses a rule on anything that
 * is not a restaurant or a window that is not the venue's. So this writes as
 * the OWNER'S OWN session, never the service role: the policy decides who may
 * change a venue's deposit, and this file only turns the card's choices into
 * rows (`planDepositRows`). A rule is never deleted, so a deposit already
 * taken keeps the rule it was taken under.
 *
 * FAILS TOWARD FREE. The rows that should no longer apply are switched off
 * first, then the wanted ones are written. A save that stops half way leaves
 * the venue asking for less, never for a deposit nobody chose.
 *
 * Gated on `restaurant_deposits`, read on the server, failing closed.
 */

import { revalidatePath } from "next/cache";
import { catalogueChanged } from "@/lib/catalogue/invalidate";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDictionary } from "@vallo/i18n";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { flagIsOn } from "../flags/read";
import { getLocale } from "../locale";
import { ensureHostSubaccount } from "../payments/payee-subaccount";
import { getAdminClient } from "@/lib/supabase/service";
import { RESTAURANT_DEPOSITS_FLAG, type DepositWords } from "./deposits";
import {
  depositSettingsProblem,
  planDepositRows,
  settingsFromRules,
  type DepositSettings,
} from "./deposit-rules";
import { ruleFromRow } from "./deposit-settings";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function words(): Promise<DepositWords["desk"]> {
  try {
    return getDictionary(await getLocale()).tableDeposits.desk;
  } catch {
    return getDictionary("en").tableDeposits.desk;
  }
}

/** The card's choices, read field by field: nothing from the client is trusted as a shape. */
function readSettings(raw: unknown): DepositSettings | null {
  const s = (raw ?? {}) as Record<string, unknown>;
  if (typeof s.on !== "boolean" || typeof s.perGuest !== "boolean") return null;
  const windowIds = s.windowIds === null ? null : Array.isArray(s.windowIds) ? s.windowIds : undefined;
  if (windowIds === undefined || (windowIds && windowIds.some((id) => typeof id !== "string" || !UUID.test(id)))) {
    return null;
  }
  const minPartySize = s.minPartySize === null ? null : Number(s.minPartySize);
  return {
    on: s.on,
    amountMinor: Number(s.amountMinor),
    perGuest: s.perGuest,
    minPartySize,
    windowIds: windowIds as string[] | null,
    refundUntilHours: Number(s.refundUntilHours),
  };
}

export async function saveDepositSettings(input: {
  businessId: string;
  settings: DepositSettings;
}): Promise<ActionResult<{ settings: DepositSettings }>> {
  const w = await words();
  if (!(await flagIsOn(RESTAURANT_DEPOSITS_FLAG))) return fail(w.notOpen);
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);

  const businessId = typeof input?.businessId === "string" ? input.businessId : "";
  const settings = readSettings(input?.settings);
  if (!UUID.test(businessId) || !settings) return fail(w.failed);

  const db = session.supabase as unknown as SupabaseClient;
  /* The owner's own read: a venue they do not own does not come back. */
  const { data: venue } = await db
    .from("businesses")
    .select("id, owner_id, kind")
    .eq("id", businessId)
    .maybeSingle();
  const v = venue as { id: string; owner_id: string; kind: string } | null;
  if (!v || v.owner_id !== session.user.id || v.kind !== "restaurant") return fail(w.notOwner);

  const [windowsRead, rulesRead] = await Promise.all([
    db.from("service_windows").select("id").eq("business_id", businessId),
    db.from("restaurant_deposit_rules").select("*").eq("business_id", businessId),
  ]);
  if (windowsRead.error || rulesRead.error) return fail(w.failed);
  const windowIds = ((windowsRead.data ?? []) as { id: string }[]).map((r) => r.id);
  const problem = depositSettingsProblem(settings, windowIds);
  if (problem) return fail(w.problems[problem]);

  const existing = ((rulesRead.data ?? []) as Parameters<typeof ruleFromRow>[0][]).map(ruleFromRow);
  const plan = planDepositRows(existing, settings);

  if (plan.deactivate.length > 0) {
    const { error } = await db
      .from("restaurant_deposit_rules")
      .update({ active: false })
      .eq("business_id", businessId)
      .in("id", plan.deactivate);
    if (error) return fail(w.failed);
  }
  for (const { id, row } of plan.update) {
    const { error } = await db.from("restaurant_deposit_rules").update(row).eq("business_id", businessId).eq("id", id);
    if (error) return fail(w.failed);
  }
  if (plan.insert.length > 0) {
    const { error } = await db
      .from("restaurant_deposit_rules")
      .insert(plan.insert.map((row) => ({ ...row, business_id: businessId })));
    if (error) return fail(w.failed);
  }

  /* A deposit reaches the venue through its own subaccount. When they turn
     deposits on with a bank account already added, make sure it has one;
     best effort, the card says so when it still does not. */
  if (settings.on) {
    const admin = getAdminClient();
    if (admin) await ensureHostSubaccount(admin, session.user.id);
  }

  const { data: after } = await db.from("restaurant_deposit_rules").select("*").eq("business_id", businessId);
  revalidatePath("/host/reservations");
  catalogueChanged({ venueId: businessId });
  revalidatePath(`/restaurant/${businessId}`);
  return ok({
    settings: settingsFromRules(((after ?? []) as Parameters<typeof ruleFromRow>[0][]).map(ruleFromRow)),
  });
}
