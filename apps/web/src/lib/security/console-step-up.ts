"use server";

/**
 * THE CONSOLE'S DOOR (29 September 2026; the founder's ruling of 14 November
 * 2026 below).
 *
 * Nobody opens a desk on a signed-in session alone. Before any desk opens,
 * once per sign-in session and again after twelve hours, the person confirms
 * it is them:
 *
 *  - an ADMIN or a STAFF MEMBER re-enters their own Vallo account password
 *    (an emailed code for an account that signed up with Google or Apple and
 *    has no password). The founder's ruling, 14 November 2026: a security key
 *    tied to one device locked staff out of the console on their second
 *    device, so the staff door is the account password. What it stops is an
 *    unlocked, signed-in device being used by somebody else; it is not a
 *    second factor, and a stolen password does open this door.
 *  - a SUPER ADMIN, who can grant and revoke every other person's access,
 *    still proves a security key (the platform passkey the lock on money
 *    uses, enrolled at /settings/privacy). The password door refuses them.
 *
 * The lock on money is separate and unchanged: a payout or a refund still
 * asks for its own proof (`money-step-up-actions.ts`).
 *
 * THE DATABASE ENFORCES IT, not this file. The proof is recorded in
 * public.console_step_ups against the session id in the caller's JWT, and
 * `private.has_role` / `private.staff_can` treat an admin role or a staff scope
 * as held by the caller only while that session has a live proof. So calling
 * PostgREST directly with a stolen password and the public key gets nothing
 * a member would not get. This file only runs the ceremony: a challenge bound
 * to this session, checked with the enrolled key (`money-step-up.ts`).
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { resolveSession } from "../actions/session";
import { consume, subjectForUser } from "./rate-limit";
import {
  admin,
  ceremonyOrigin,
  isStaffAccount,
  listConsoleCredentialIds,
  mintChallenge,
  spendEmailCodeMarker,
  takeChallenge,
} from "./money-step-up";
import { reauthenticate, reauthMethodFor, type ReauthMethod } from "../account-deletion/reauthenticate";
import { b64urlToBuffer, verifyAssertion, type Alg } from "./webauthn";

/** How long one proof opens the console for, on this session. */
const STEP_UP_HOURS = 12;

/** The session id in a Supabase access token, read to bind the proof (the database verifies the token). */
function sessionIdOf(accessToken: string | undefined): string | null {
  const part = accessToken?.split(".")[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { session_id?: unknown };
    return typeof claims.session_id === "string" && /^[0-9a-f-]{36}$/i.test(claims.session_id) ? claims.session_id : null;
  } catch {
    return null;
  }
}

function digestFor(sessionId: string): string {
  return createHash("sha256").update(`console:${sessionId}`).digest("hex");
}

async function current() {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const { data } = await session.supabase.auth.getSession();
  const sessionId = sessionIdOf(data.session?.access_token);
  return sessionId ? { session, sessionId } : null;
}

export type ConsoleStepUpStart =
  | { state: "ready"; challenge: string; credentialIds: string[]; rpId: string }
  /* C14: no key that may open the console (none enrolled, or every one
     revoked for the console): enrol a new one here, on the first-key proof. */
  | { state: "enrol"; method: ReauthMethod }
  | { state: "failed" };

export async function beginConsoleStepUp(): Promise<ConsoleStepUpStart> {
  const now = await current();
  const a = admin();
  if (!now || !a) return { state: "failed" };
  const ids = await listConsoleCredentialIds(a, now.session.user.id);
  if (ids === null) return { state: "failed" };
  if (ids.length === 0) return { state: "enrol", method: reauthMethodFor(now.session.user) };
  const challenge = await mintChallenge(a, now.session.user.id, "money", digestFor(now.sessionId));
  const { rpId } = await ceremonyOrigin();
  return challenge ? { state: "ready", challenge, credentialIds: ids, rpId } : { state: "failed" };
}

const assertionSchema = z.object({
  challenge: z.string().min(20).max(200),
  credentialId: z.string().min(16).max(1400),
  clientDataJSON: z.string().min(10).max(4000),
  authenticatorData: z.string().min(10).max(4000),
  signature: z.string().min(10).max(2000),
});

export async function finishConsoleStepUp(input: unknown): Promise<ActionResult<null>> {
  const parsed = assertionSchema.safeParse(input);
  if (!parsed.success) return fail("rejected");
  const now = await current();
  const a = admin();
  if (!now || !a) return fail("failed");
  const userId = now.session.user.id;
  const paced = await consume({ bucket: "console_step_up", subject: subjectForUser(userId), limit: 10, windowSeconds: 900 });
  if (!paced.allowed) return fail("rejected");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = a as any;
  const { data: key } = await loose
    .from("money_credentials")
    .select("id, public_key_spki, alg, sign_count")
    .eq("user_id", userId)
    .eq("credential_id", parsed.data.credentialId)
    .maybeSingle();
  if (!key) return fail("rejected");
  const row = key as { id: string; public_key_spki: string; alg: Alg; sign_count: number };
  const { origin, rpId } = await ceremonyOrigin();
  const verdict = verifyAssertion({
    clientDataJSON: b64urlToBuffer(parsed.data.clientDataJSON),
    authenticatorData: b64urlToBuffer(parsed.data.authenticatorData),
    signature: b64urlToBuffer(parsed.data.signature),
    publicKeySpki: b64urlToBuffer(row.public_key_spki),
    alg: row.alg,
    storedSignCount: Number(row.sign_count),
    challenge: parsed.data.challenge,
    origins: [origin],
    rpId,
  });
  if (!verdict.ok) return fail("rejected");
  /* The challenge was minted for THIS session; a proof made on another
     session (or for money) is refused here. */
  const digest = await takeChallenge(a, userId, parsed.data.challenge, "money");
  if (digest !== digestFor(now.sessionId)) return fail("rejected");

  await loose
    .from("money_credentials")
    .update({ sign_count: verdict.signCount, last_used_at: new Date().toISOString() })
    .eq("id", row.id);
  return (await openConsole(loose, userId, now.sessionId, { method: "key", credentialId: parsed.data.credentialId }))
    ? ok(null)
    : fail("failed");
}

/**
 * Write the proof that opens the console for THIS session for twelve hours,
 * and the audit line that says how it was proved. The database reads the row
 * (`private.console_step_up_ok`); nothing else opens a desk.
 */
async function openConsole(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loose: any,
  userId: string,
  sessionId: string,
  proof: { method: "key"; credentialId: string } | { method: "password" | "email_code" },
): Promise<boolean> {
  const expires = new Date(Date.now() + STEP_UP_HOURS * 3_600_000).toISOString();
  /* This person's lapsed proofs go as the new one is written. */
  await loose.from("console_step_ups").delete().eq("user_id", userId).lt("expires_at", new Date().toISOString());
  const { error } = await loose.from("console_step_ups").upsert(
    {
      user_id: userId,
      session_id: sessionId,
      credential_id: proof.method === "key" ? proof.credentialId : null,
      verified_at: new Date().toISOString(),
      expires_at: expires,
    },
    { onConflict: "user_id,session_id" },
  );
  if (error) return false;
  await loose.from("audit_log").insert({
    actor_id: userId,
    action: "console.step_up",
    entity_type: "user",
    entity_id: userId,
    metadata: { expires_at: expires, method: proof.method },
  });
  return true;
}

const passwordProofSchema = z.object({
  password: z.string().min(1).max(200).optional(),
  code: z
    .string()
    .trim()
    .regex(/^\d{6,10}$/)
    .optional(),
});

/** Why the password door stayed shut: a wrong proof, too many tries, a super admin, or our fault. */
export type ConsolePasswordError = "rejected" | "too_many" | "key_only" | "failed";

/**
 * THE STAFF DOOR: the person's own account password (or, for an account with
 * no password, a code emailed by `sendFallbackCode`). Five tries in fifteen
 * minutes, counted before the password is looked at, so the console is not a
 * faster way to guess one than sign-in. A super admin is refused here and
 * uses their key.
 */
export async function confirmConsoleWithPassword(input: unknown): Promise<ActionResult<null>> {
  const parsed = passwordProofSchema.safeParse(input);
  if (!parsed.success) return fail("rejected" satisfies ConsolePasswordError);
  const now = await current();
  const a = admin();
  if (!now || !a) return fail("failed" satisfies ConsolePasswordError);
  const user = now.session.user;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loose = a as any;
  const { data: roles, error: rolesError } = await loose.from("user_roles").select("role").eq("user_id", user.id);
  /* A role that cannot be read is not proof that somebody is not a super admin. */
  if (rolesError) return fail("failed" satisfies ConsolePasswordError);
  if (((roles ?? []) as { role: string }[]).some((r) => r.role === "super_admin")) {
    return fail("key_only" satisfies ConsolePasswordError);
  }
  /* Nobody but staff has a console to open. */
  if (!(await isStaffAccount(a, user.id))) return fail("rejected" satisfies ConsolePasswordError);

  const paced = await consume({ bucket: "console_password", subject: subjectForUser(user.id), limit: 5, windowSeconds: 900 });
  /* A limiter that could not count is not a limit: closed, for guesses. */
  if (!paced.allowed) return fail("too_many" satisfies ConsolePasswordError);
  if (paced.degraded) return fail("failed" satisfies ConsolePasswordError);

  const method = reauthMethodFor(user);
  let proved = false;
  if (method === "password") {
    const password = parsed.data.password ?? "";
    if (password.length === 0) return fail("rejected" satisfies ConsolePasswordError);
    proved = await reauthenticate(user, { password });
  } else {
    const code = parsed.data.code ?? "";
    if (code.length === 0) return fail("rejected" satisfies ConsolePasswordError);
    /* Only a code this account asked the lock to send (`sendFallbackCode`). */
    proved = await spendEmailCodeMarker(a, user.id, () => reauthenticate(user, { emailCode: code }));
  }
  if (!proved) return fail("rejected" satisfies ConsolePasswordError);

  return (await openConsole(loose, user.id, now.sessionId, { method: method === "password" ? "password" : "email_code" }))
    ? ok(null)
    : fail("failed" satisfies ConsolePasswordError);
}
