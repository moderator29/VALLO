"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { resolveSession } from "@/lib/actions/session";
import { fail, ok, validate, type ActionResult } from "@/lib/actions/envelope";
import { passcodeMoneyRefusal } from "@/lib/passcode/money";
import { consume, subjectForUser } from "@/lib/security/rate-limit";
import { auditAction } from "./access";
import {
  ACTIVATION_PERMISSIONS,
  AI_PERMISSIONS,
  isSensitivePermission,
  type AiPermission,
} from "./permissions";

/**
 * THE ASSISTANT'S SETTINGS, AS SERVER ACTIONS.
 *
 * Every one signs the person in from the session cookie, validates its input,
 * is rate limited, and then calls a database function that reads `auth.uid()`
 * itself. The database is where the rules live (both acceptances, the current
 * versions, the sensitive permissions being granted separately); this file is
 * the polite front of it, and the second lock in front of the sensitive ones:
 * a locked Vallo session cannot grant access to money information.
 */

const PATH = "/settings/ai-assistant";

const REASONS: Record<string, string> = {
  signed_out: "Sign in to change the assistant's settings.",
  terms_not_accepted: "Tick both agreements to turn the assistant on.",
  version_mismatch: "The terms were updated while you were reading. Reload the page and read them again.",
  permission_not_grantable_here: "That permission is switched on separately, after the assistant is on.",
  assistant_off: "Turn the assistant on first.",
  needs_a_read_permission_first: "Payment help needs access to your transactions or your bookings first.",
  unknown_permission: "That is not a permission the assistant has.",
};
const reason = (code: unknown): string =>
  typeof code === "string" ? (REASONS[code] ?? "That did not go through. Nothing was changed.") : "That did not go through. Nothing was changed.";

type Signed = Extract<Awaited<ReturnType<typeof resolveSession>>, { state: "signed-in" }>;

async function signedIn(bucket: string): Promise<{ session: Signed } | { refusal: ActionResult<never> }> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return { refusal: fail(REASONS.signed_out!) };
  const verdict = await consume({ bucket, subject: subjectForUser(session.user.id), limit: 20, windowSeconds: 600 });
  if (!verdict.allowed) {
    return { refusal: fail(`That is a lot of changes at once. Try again ${verdict.retryIn}.`) };
  }
  return { session };
}

type Rpc = { rpc: (fn: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
async function call(session: Signed, fn: string, args?: Record<string, unknown>): Promise<ActionResult<null>> {
  try {
    const { data, error } = await (session.supabase as unknown as Rpc).rpc(fn, args);
    if (error || !data || typeof data !== "object") return fail("We could not save that just now. Nothing was changed.");
    const d = data as { ok?: boolean; reason?: string };
    if (d.ok !== true) return fail(reason(d.reason));
    revalidatePath(PATH);
    revalidatePath("/settings");
    return ok(null);
  } catch {
    return fail("We could not save that just now. Nothing was changed.");
  }
}

const activateSchema = z.object({
  acceptTerms: z.literal(true, { message: "Tick the Terms of Service." }),
  acceptPrivacy: z.literal(true, { message: "Tick the Privacy Policy." }),
  agree: z.literal(true, { message: "Tick the agreement to continue." }),
  termsVersion: z.string().max(20),
  privacyVersion: z.string().max(20),
  permissions: z.array(z.enum(AI_PERMISSIONS)).max(8).default([]),
});

/** Turn the assistant on. Needs both documents accepted and the one agreement tick; the database checks again. */
export async function activateAssistant(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(activateSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const gate = await signedIn("ai_assistant_settings");
  if ("refusal" in gate) return gate.refusal;
  const grantable = parsed.data.permissions.filter((p) => ACTIVATION_PERMISSIONS.includes(p));
  if (grantable.length !== parsed.data.permissions.length) return fail(reason("permission_not_grantable_here"));
  return call(gate.session, "ai_assistant_activate", {
    p_terms_version: parsed.data.termsVersion,
    p_privacy_version: parsed.data.privacyVersion,
    p_accept_terms: parsed.data.acceptTerms,
    p_accept_privacy: parsed.data.acceptPrivacy,
    p_permissions: parsed.data.permissions,
  });
}

/** Turn the assistant off: permissions revoked, sessions invalidated, pending proposals cancelled. Records are kept. */
export async function deactivateAssistant(): Promise<ActionResult<null>> {
  const gate = await signedIn("ai_assistant_settings");
  if ("refusal" in gate) return gate.refusal;
  return call(gate.session, "ai_assistant_deactivate");
}

const permissionSchema = z.object({ permission: z.enum(AI_PERMISSIONS), granted: z.boolean() });

/**
 * Grant or revoke ONE permission. Granting a sensitive one (transactions, wallet
 * balance, payment help) also needs the Vallo session to be unlocked: a locked
 * session moves no money and shares no money information.
 */
export async function setAssistantPermission(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(permissionSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const gate = await signedIn("ai_assistant_settings");
  if ("refusal" in gate) return gate.refusal;
  const permission: AiPermission = parsed.data.permission;
  if (parsed.data.granted && isSensitivePermission(permission)) {
    const locked = await passcodeMoneyRefusal(gate.session.user.id);
    if (locked) {
      await auditAction(gate.session.supabase, { event: "permission_refused", permission, outcome: "refused", detail: { reason: "session_locked" } });
      return fail(locked);
    }
  }
  return call(gate.session, "ai_assistant_set_permission", { p_permission: permission, p_granted: parsed.data.granted });
}

/** Clear everything the assistant learned about what this person likes. */
export async function clearLearnedPreferences(): Promise<ActionResult<null>> {
  const gate = await signedIn("ai_assistant_settings");
  if ("refusal" in gate) return gate.refusal;
  return call(gate.session, "ai_assistant_clear_preferences");
}

const prefSchema = z.object({
  key: z.string().trim().min(1).max(80),
  stance: z.enum(["like", "dislike", "remove"]),
});

/** Say that you like or dislike something it learned, or remove it. Only your own rows are reachable (row level security). */
export async function setLearnedPreference(input: unknown): Promise<ActionResult<null>> {
  const parsed = validate(prefSchema, input);
  if (!parsed.ok) return fail(parsed.error, parsed.fieldErrors);
  const gate = await signedIn("ai_assistant_settings");
  if ("refusal" in gate) return gate.refusal;
  const db = gate.session.supabase as unknown as {
    from: (t: string) => {
      update: (v: Record<string, unknown>) => { eq: (c: string, v: string) => { eq: (c: string, v: string) => PromiseLike<{ error: unknown }> } };
    };
  };
  const mine = gate.session.user.id;
  /* Forgetting one scrubs its words and weight in the database (a function, never a table delete). */
  if (parsed.data.stance === "remove") {
    return call(gate.session, "ai_assistant_forget_preference", { p_key: parsed.data.key });
  }
  const result = await db
          .from("ai_learned_preferences")
          .update({ weight: parsed.data.stance === "like" ? 3 : -3, source: "member", updated_at: new Date().toISOString() })
          .eq("user_id", mine)
          .eq("key", parsed.data.key);
  if (result.error) return fail("We could not save that just now. Nothing was changed.");
  revalidatePath(PATH);
  return ok(null);
}
