"use server";

import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { flagIsOn } from "../flags/read";
import { hasServiceRole } from "../security/service-rpc";
import { dojahConfig } from "./dojah/config";
import { dojahHostedUrl } from "./dojah/link";

/**
 * THE SELFIE CHECK, FROM THE MEMBER'S SIDE (Dojah EasyOnboard).
 *
 * `startDojahCheck` opens (or reuses) a check row and answers the hosted link
 * the screen puts in a frame. `dojahCheckStatus` is what the screen polls
 * while the person is in the flow and just after: it reads the row the signed
 * webhook writes, never anything the browser says about itself.
 *
 * Closed unless `dojah_identity` is on AND Dojah is configured with a widget
 * and a webhook secret AND the service role and the NIN HMAC key are present:
 * without the webhook nothing could ever be decided, and without the key a
 * NIN could not be hashed, so opening the flow would only spend the person's
 * time and Vallo's wallet.
 */

export type DojahStatus =
  | "none"
  | "opened"
  | "waiting"
  | "passed"
  | "review"
  | "retry"
  | "abandoned"
  | "approved"
  | "refused"
  | "verified";

export async function dojahCheckReady(): Promise<boolean> {
  const config = dojahConfig();
  if (!config?.widgetId || !config.webhookSecret) return false;
  if (!hasServiceRole() || (process.env.VALLO_NIN_HMAC_KEY ?? "").length < 32) return false;
  return flagIsOn("dojah_identity");
}

type Rpc = { rpc(fn: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> };
type Loose = Rpc & {
  from(t: string): {
    select(c: string): { eq(c: string, v: string): { maybeSingle(): Promise<{ data: unknown }> } };
  };
};

export async function startDojahCheck(): Promise<
  ActionResult<{ url: string } | { status: "verified" | "in_review" | "limit" | "closed" }>
> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const config = dojahConfig();
  if (!config?.widgetId || !(await dojahCheckReady())) return ok({ status: "closed" });

  const db = session.supabase as unknown as Loose;
  const { data, error } = await db.rpc("open_identity_check", { p_environment: config.environment });
  if (error || !data || typeof data !== "object") return fail("We could not open the check just now. Try again in a moment.");
  const answer = data as { status?: string; id?: string };
  if (answer.status === "verified" || answer.status === "in_review" || answer.status === "limit") {
    return ok({ status: answer.status });
  }
  if (answer.status !== "opened" || typeof answer.id !== "string") {
    return fail("We could not open the check just now. Try again in a moment.");
  }

  const { data: profile } = await db
    .from("profiles")
    .select("first_name, surname")
    .eq("id", session.user.id)
    .maybeSingle();
  const p = profile as { first_name?: string | null; surname?: string | null } | null;
  return ok({ url: dojahHostedUrl({ widgetId: config.widgetId, checkId: answer.id, firstName: p?.first_name, lastName: p?.surname }) });
}

export async function dojahCheckStatus(): Promise<ActionResult<{ status: DojahStatus; note: string | null }>> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return fail(NOT_CONFIGURED_MESSAGE);
  if (session.state === "signed-out") return fail(SIGNED_OUT_MESSAGE);
  const { data, error } = await (session.supabase as unknown as Rpc).rpc("my_identity_check");
  if (error || !data || typeof data !== "object") return fail("We could not read your check just now.");
  const answer = data as { status?: string; note?: string | null };
  const known: DojahStatus[] = ["none", "opened", "waiting", "passed", "review", "retry", "abandoned", "approved", "refused", "verified"];
  const status = known.includes(answer.status as DojahStatus) ? (answer.status as DojahStatus) : "none";
  return ok({ status, note: typeof answer.note === "string" ? answer.note : null });
}
