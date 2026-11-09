"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { resolveSession } from "../actions/session";

/**
 * TAKE A REPORT BACK. V-89.
 *
 * Only the reporter, only while it is open or being reviewed, through
 * `public.withdraw_my_report`, which checks both in the database and writes
 * the audit row. A code, not a sentence: the screen owns the words.
 */
export async function withdrawMyReport(input: unknown): Promise<ActionResult<{ state: "ok" | "closed" }>> {
  const v = validate(z.object({ id: z.string().uuid() }), input);
  if (!v.ok) return v;
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("Not signed in");
  try {
    const { data, error } = (await (session.supabase as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
    }).rpc("withdraw_my_report", { p_report: v.data.id })) as { data: unknown; error: unknown };
    const status = (data as { status?: string } | null)?.status;
    if (error) return fail("Could not withdraw the report");
    if (status === "ok") {
      revalidatePath("/settings/help");
      return ok({ state: "ok" as const });
    }
    if (status === "closed") return ok({ state: "closed" as const });
    return fail("Could not withdraw the report");
  } catch {
    return fail("Could not withdraw the report");
  }
}
