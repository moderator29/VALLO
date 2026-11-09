"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

import { fail, ok, type ActionResult } from "@/lib/actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "@/lib/actions/session";
import { isNotLive } from "@/lib/features/degrade";

/** Appeal a restriction. The database checks it is yours and not already decided on appeal. */
export async function appealRestriction(input: { restrictionId: string; body: string }): Promise<ActionResult<{ id: string }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const body = (input.body ?? "").trim();
  if (body.length < 10) return fail("Tell us why, in a sentence or two.", { body: "A sentence or two, please." });
  if (body.length > 2000) return fail("Keep it to 2,000 characters.");
  const db = session.supabase as unknown as SupabaseClient;
  const { data, error } = await db.rpc("appeal_restriction", { p_restriction: input.restrictionId, p_body: body });
  if (error) {
    if (isNotLive(error)) return fail("Appeals are not open on this server yet.");
    if (error.code === "23505") return fail("Your appeal is already with our team.");
    if (typeof error.code === "string" && /^RM\d{3}$/.test(error.code) && error.message) return fail(error.message);
    return fail("That did not go through. Try again.");
  }
  revalidatePath("/settings/standing");
  return ok({ id: String(data) });
}
