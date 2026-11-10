import "server-only";

import { fail, ok, type ActionResult } from "../actions/envelope";
import { NOT_CONFIGURED_MESSAGE, SIGNED_OUT_MESSAGE, resolveSession } from "../actions/session";
import { getAdminClient } from "../supabase/service";
import { DOOR_FALLBACK, DOOR_WORDS } from "./door-words";

/**
 * THE ONE WAY INTO THE OFFER DATABASE FUNCTIONS. Each takes the caller's id as
 * its first argument and checks for itself that the caller is a party, whose
 * turn it is, and that the version is current. The id here comes from the
 * session and nowhere else.
 */
export type RpcAnswer = Record<string, unknown> & { status?: string };

type Caller = { rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message?: string } | null }> };

export async function sessionUserId(): Promise<{ id: string } | { error: string }> {
  const session = await resolveSession();
  if (session.state === "unconfigured") return { error: NOT_CONFIGURED_MESSAGE };
  if (session.state === "signed-out") return { error: SIGNED_OUT_MESSAGE };
  return { id: session.user.id };
}

/** Calls a service function with the session user first. Returns the raw answer or a refusal sentence. */
export async function callAs(fn: string, args: (userId: string) => Record<string, unknown>): Promise<{ ok: true; answer: RpcAnswer } | { ok: false; error: string; status?: string }> {
  const who = await sessionUserId();
  if ("error" in who) return { ok: false, error: who.error, status: "not_signed_in" };
  const admin = getAdminClient();
  if (!admin) return { ok: false, error: NOT_CONFIGURED_MESSAGE };
  const { data, error } = await (admin as unknown as Caller).rpc(fn, args(who.id));
  if (error) return { ok: false, error: DOOR_FALLBACK };
  return { ok: true, answer: (data ?? {}) as RpcAnswer };
}

/** A write door: `ok` is the only success; anything else becomes its sentence. */
export async function writeDoor<T>(
  fn: string,
  args: (userId: string) => Record<string, unknown>,
  map: (answer: RpcAnswer) => T,
  alsoOk: readonly string[] = [],
): Promise<ActionResult<T>> {
  const result = await callAs(fn, args);
  if (!result.ok) return fail(result.error);
  const status = String(result.answer.status ?? "");
  if (status !== "ok" && !alsoOk.includes(status)) {
    return fail(DOOR_WORDS[status] ?? DOOR_FALLBACK);
  }
  return ok(map(result.answer));
}
