"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { resolveSession, resolveSessionClaims } from "../actions/session";
import { afterResponse } from "../auth/after-response";
import { consume, subjectForUser } from "../security/rate-limit";
import { ceremonyOrigin, listCredentialIds, mintChallenge, takeChallenge } from "../security/money-step-up";
import { b64urlToBuffer, verifyAssertion, type Alg } from "../security/webauthn";
import { createAdminClient } from "../supabase/admin";
import { isServiceConfigured } from "../supabase/service";
import { readPasscodeStatus, writeUnlock } from "./state";
import { turnPasscodeOff } from "./turn-off";

/**
 * UNLOCK WITH FACE ID OR FINGERPRINT (C14), the ceremony docs/PASSCODE.md
 * section 8 asks for: the same WebAuthn platform key the money lock and the
 * console already use (`money_credentials`, `lib/security/webauthn.ts`), an
 * assertion the SERVER verifies, and only then the signed unlock cookie. A
 * local "passed" is never trusted.
 *
 * The challenge is the money lock's own table with the money purpose, bound to
 * THIS session and to unlocking by its digest (`passcode-unlock:<session>`),
 * exactly as the console binds its proof to `console:<session>`. So a proof
 * made for a payment or for the console cannot unlock the passcode, and one
 * made on another session cannot either. No migration is needed.
 *
 * It unlocks only a passcode that is SET. A passcode that needs resetting, or
 * none at all, is not unlocked by a key: those go through the password.
 */

function sessionIdOf(accessToken: string | undefined): string | null {
  const part = accessToken?.split(".")[1];
  if (!part) return null;
  try {
    const claims = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as { session_id?: unknown };
    return sessionIdFrom(claims.session_id);
  } catch {
    return null;
  }
}

function sessionIdFrom(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function digestFor(sessionId: string, purpose: "unlock" | "off" = "unlock"): string {
  /* "off" (13 November 2026): a proof made to turn the passcode off is bound
     to that, so an unlock proof can never be replayed to remove the lock, nor
     the other way round. */
  return createHash("sha256").update(`${purpose === "off" ? "passcode-off" : "passcode-unlock"}:${sessionId}`).digest("hex");
}

/**
 * The longest any one database call on this path may take (SPEED, 13
 * November 2026). Each is a single indexed row (a key by its unique
 * credential id, a challenge by its unique value); three seconds is only
 * reached in a stall, and the ceremony then answers "that did not work" with
 * the keypad beside it, instead of a Face ID button spinning with no end.
 */
const PASSKEY_DB_WAIT_MS = 3_000;

/** The service-role client for this path, with the deadline above. Null without a service key. */
function fastAdmin(): ReturnType<typeof createAdminClient> | null {
  if (!isServiceConfigured()) return null;
  try {
    return createAdminClient({ deadlineMs: PASSKEY_DB_WAIT_MS });
  } catch {
    return null;
  }
}

type Caller = { userId: string; sessionId: string; supabase: unknown };

/**
 * WHO IS ASKING, IN NO ROUND TRIP FOR AN UNLOCK (SPEED, 13 November 2026).
 *
 * An UNLOCK identifies the caller the way the passcode's own check does
 * (`readPasscodeSession`, `resolveSessionClaims`): the access token's
 * signature verified locally against the project's published keys, with the
 * session id taken from those verified claims. It used to ask GoTrue
 * (`getUser`, a network round trip) before anything else could start.
 *
 * TURNING THE LOCK OFF keeps the GoTrue check (`strict`), because removing a
 * protection is the one step here where a session revoked a moment ago must
 * not count. It is not on the path anybody waits on to open the app.
 */
async function current(strict: boolean): Promise<Caller | null> {
  if (strict) {
    const session = await resolveSession();
    if (session.state !== "signed-in") return null;
    const { data } = await session.supabase.auth.getSession();
    const sessionId = sessionIdOf(data.session?.access_token);
    return sessionId ? { userId: session.user.id, sessionId, supabase: session.supabase } : null;
  }
  const session = await resolveSessionClaims();
  if (session.state !== "signed-in") return null;
  const answer = await session.supabase.auth.getClaims().catch(() => null);
  const claims = !answer || answer.error ? null : (answer.data?.claims as { sub?: unknown; session_id?: unknown } | undefined);
  const sessionId = sessionIdFrom(claims?.session_id);
  if (!sessionId || claims?.sub !== session.userId) return null;
  return { userId: session.userId, sessionId, supabase: session.supabase };
}

export type PasskeyUnlockStart =
  | { state: "ready"; challenge: string; credentialIds: string[]; rpId: string }
  | { state: "none" }
  | { state: "failed" };

/** Whether this member has a key at all, for showing the button. Asks nothing of the device. */
export async function passkeyUnlockOffered(): Promise<boolean> {
  /* SPEED: read on EVERY member page by the (app) layout, so it identifies the
     caller from the verified token (no GoTrue round trip) and its one read is
     bounded. Only whether to draw a button hangs on it; a failure is "no". */
  const session = await resolveSessionClaims();
  const a = fastAdmin();
  if (session.state !== "signed-in" || !a) return false;
  const ids = await listCredentialIds(a, session.userId);
  return Array.isArray(ids) && ids.length > 0;
}

/**
 * ONE ROUND TRIP (SPEED, 13 November 2026). The key list and the new
 * challenge are asked together: they never depended on each other, and they
 * used to follow a GoTrue call and each other in series (three trips). A
 * member with no key at all is rare here (the button is drawn only for a
 * member who has one), and the challenge minted for them simply expires in
 * five minutes, unused, like any challenge nobody answers.
 */
export async function beginPasskeyUnlock(purpose: "unlock" | "off" = "unlock"): Promise<PasskeyUnlockStart> {
  const bound: "unlock" | "off" = purpose === "off" ? "off" : "unlock";
  const now = await current(bound === "off");
  const a = fastAdmin();
  if (!now || !a) return { state: "failed" };
  const [ids, challenge, { rpId }] = await Promise.all([
    listCredentialIds(a, now.userId),
    mintChallenge(a, now.userId, "money", digestFor(now.sessionId, bound)).catch(() => null),
    ceremonyOrigin(),
  ]);
  if (ids === null) return { state: "failed" };
  if (ids.length === 0) return { state: "none" };
  return challenge ? { state: "ready", challenge, credentialIds: ids, rpId } : { state: "failed" };
}

const assertionSchema = z.object({
  challenge: z.string().min(20).max(200),
  credentialId: z.string().min(16).max(1400),
  clientDataJSON: z.string().min(10).max(4000),
  authenticatorData: z.string().min(10).max(4000),
  signature: z.string().min(10).max(2000),
});

type KeyRow = { id: string; public_key_spki: string; alg: Alg; sign_count: number };

async function keyFor(a: NonNullable<ReturnType<typeof fastAdmin>>, userId: string, credentialId: string): Promise<KeyRow | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (a as any)
      .from("money_credentials")
      .select("id, public_key_spki, alg, sign_count")
      .eq("user_id", userId)
      .eq("credential_id", credentialId)
      .maybeSingle();
    return (data as KeyRow | null) ?? null;
  } catch {
    return null;
  }
}

/**
 * THE PROOF, IN ONE ROUND TRIP (SPEED, 13 November 2026).
 *
 * Every database question this needs is asked AT ONCE: the pacing count, the
 * passcode's state, the member's key, and the single-use challenge (taken,
 * which is what returns the purpose and session it was minted for). Then the
 * signature is checked here, in memory, and every answer must agree before
 * anything is written. It used to be six trips in series (GoTrue, the count,
 * the state, the key, the challenge, the key's counter).
 *
 * WHAT TAKING THE CHALLENGE EARLY CHANGES, AND WHY IT IS SAFE. The challenge
 * is now spent even when this attempt is then refused (paced, a bad
 * signature, the wrong purpose). It is single use, bound to this account and
 * this session, and an attempt that fails could never have used it again
 * anyway: the next tap asks for a fresh one, as it always did. Nothing
 * refused here unlocks anything, because the unlock is written only after
 * all five answers agree.
 *
 * The key's signature counter and last-used time are written after the
 * response (`afterResponse`): bookkeeping that decides nothing about this
 * unlock. The counter is still checked on every proof against the stored
 * value.
 */
async function proveWithKey(input: unknown, purpose: "unlock" | "off"): Promise<ActionResult<{ userId: string }>> {
  const parsed = assertionSchema.safeParse(input);
  if (!parsed.success) return fail("rejected");
  const now = await current(purpose === "off");
  const a = fastAdmin();
  if (!now || !a) return fail("failed");
  const userId = now.userId;

  const [paced, status, row, digest, { origin, rpId }] = await Promise.all([
    consume({ bucket: "passcode_passkey", subject: subjectForUser(userId), limit: 10, windowSeconds: 900 }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readPasscodeStatus(now.supabase as any, { waitMs: PASSKEY_DB_WAIT_MS }),
    keyFor(a, userId, parsed.data.credentialId),
    takeChallenge(a, userId, parsed.data.challenge, "money").catch(() => null),
    ceremonyOrigin(),
  ]);
  if (!paced.allowed) return fail("rejected");
  if (status.state !== "set") return fail(status.state === "error" ? "failed" : "not_set");
  if (!row) return fail("rejected");

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
  if (digest !== digestFor(now.sessionId, purpose)) return fail("rejected");

  const signCount = verdict.signCount;
  afterResponse(async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (a as any)
      .from("money_credentials")
      .update({ sign_count: signCount, last_used_at: new Date().toISOString() })
      .eq("id", row.id);
  });
  return ok({ userId });
}

export async function finishPasskeyUnlock(input: unknown): Promise<ActionResult<null>> {
  const proven = await proveWithKey(input, "unlock");
  if (!proven.ok) return proven;
  const written = await writeUnlock(proven.data.userId);
  return written ? ok(null) : fail("failed");
}

/**
 * TURN THE PASSCODE OFF WITH FACE ID OR A FINGERPRINT (13 November 2026). The
 * same server-verified ceremony as the unlock, with its challenge bound to
 * turning the lock off (`beginPasskeyUnlock("off")`); only a verified proof
 * turns it off (`turn-off.ts`).
 */
export async function finishPasscodeOffWithKey(input: unknown): Promise<ActionResult<null>> {
  const proven = await proveWithKey(input, "off");
  if (!proven.ok) return proven;
  return (await turnPasscodeOff(proven.data.userId, "key")) ? ok(null) : fail("failed");
}
