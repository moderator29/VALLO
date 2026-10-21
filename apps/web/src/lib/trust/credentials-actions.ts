"use server";

import { revalidatePath } from "next/cache";
import { getDictionary } from "@vallo/i18n";
import { z } from "zod";
import { fail, ok, validate, type ActionResult } from "../actions/envelope";
import { adminRefusal, requireAdmin } from "../admin/guard";
import { credentialRefusal } from "./credential-answer";

/**
 * V-87: staff record a LASRERA or ESVARBON entry they read on the public
 * register, with the number AND the name the register shows. The database
 * refuses anybody who is not staff (`public.record_credential` guards inside),
 * and refuses a CAC directorship, which the free CAC search cannot show, so
 * this action does not offer one. The desk reads English, so the answers come
 * from the English dictionary.
 */

const desk = getDictionary("en").trustVisible.desk;

const schema = z.object({
  subjectId: z.string().uuid(),
  kind: z.enum(["lasrera", "esvarbon"]),
  number: z.string().trim().min(2, desk.credentialInvalid).max(60),
  registerName: z.string().trim().min(2, desk.credentialNoName).max(200),
});

type RpcCaller = { rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }> };

export async function recordCredential(input: unknown): Promise<ActionResult<{ recorded: true }>> {
  /* The KYC desk's scope. The call still goes through the caller's OWN
     client, because `record_credential` decides on auth.uid() with
     `private.staff_can(actor, 'kyc_review')`. */
  const access = await requireAdmin("kyc_review");
  if (access.state !== "admin") return fail(adminRefusal(access));
  const parsed = validate(schema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  /* Nobody records a register check on themselves: it is a mark others read. */
  if (parsed.data.subjectId === access.user.id) {
    return fail("This is your own record, so another reviewer has to check it. Nothing was recorded.");
  }
  const { data, error } = await (access.userClient as unknown as RpcCaller).rpc("record_credential", {
    p_subject: parsed.data.subjectId,
    p_kind: parsed.data.kind,
    p_number: parsed.data.number,
    p_company: null,
    p_source: "register_by_hand",
    p_register_name: parsed.data.registerName,
  });
  if (error) return fail(desk.credentialFailed);
  const refusal = credentialRefusal(data, desk);
  if (refusal) return fail(refusal);
  revalidatePath("/admin/kyc");
  return ok({ recorded: true });
}
