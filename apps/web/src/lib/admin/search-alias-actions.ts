"use server";

/**
 * The search desk's two writes: add or change a staff alias, and switch one on
 * or off. Each goes through a SECURITY DEFINER function called with the
 * person's OWN client (`admin_search_alias_put`, `admin_search_alias_set_active`),
 * which admits an admin or staff with `content` or `marketing` on a session
 * that proved its key, and writes `public.audit_log` in the same transaction.
 * Nothing is ever deleted: a disabled alias stays on record.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { isNotLive } from "../features/degrade";
import { forgetStaffAliases } from "../intelligence/analytics";
import { deskRefusal } from "./desk-refusal";
import { searchDeskDoor } from "./search-desk";

const NOT_SET_UP = "Search aliases are not set up yet. Nothing was changed.";
const FAILED = "That did not go through. Nothing was changed. Try again.";
const FORBIDDEN = "Your staff role does not allow changing search aliases.";

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };

const putSchema = z.object({
  fromText: z.string().trim().min(1, "Write the words people type.").max(60, "Keep it under 60 characters."),
  toText: z.string().trim().min(1, "Write what they mean.").max(60, "Keep it under 60 characters."),
  kind: z.enum(["word", "place"]),
});

const activeSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

async function run(fn: string, args: Record<string, unknown>): Promise<ActionResult<null>> {
  const door = await searchDeskDoor();
  if (door.state !== "ok") return fail(door.state === "not-admin" ? FORBIDDEN : deskRefusal(door.state));
  try {
    const { data, error } = await (door.db as unknown as Rpc).rpc(fn, args);
    if (error) return fail(isNotLive(error) ? NOT_SET_UP : FAILED);
    const body = (data ?? {}) as { status?: string; reason?: string };
    if (body.status === "forbidden") return fail(FORBIDDEN);
    if (body.status === "invalid") return fail(typeof body.reason === "string" ? body.reason : FAILED);
    if (body.status === "not_found") return fail("That alias is not there any more. Refresh the page.");
    if (body.status !== "ok") return fail(FAILED);
  } catch {
    return fail(FAILED);
  }
  forgetStaffAliases();
  revalidatePath("/admin/search");
  return ok(null);
}

/** Add an alias, or change where an existing one points (it is switched on again). */
export async function putSearchAlias(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(putSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  return run("admin_search_alias_put", { p_from: parsed.data.fromText, p_to: parsed.data.toText, p_kind: parsed.data.kind });
}

/** Switch an alias off (or back on). It stays on record either way. */
export async function setSearchAliasActive(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(activeSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  return run("admin_search_alias_set_active", { p_id: parsed.data.id, p_active: parsed.data.active });
}
