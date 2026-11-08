"use server";

import { createHash } from "node:crypto";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { resolveSession } from "../actions/session";
import { consume, subjectForUser } from "../security/rate-limit";
import { admin, ceremonyOrigin, listCredentialIds, mintChallenge, takeChallenge } from "../security/money-step-up";
import { b64urlToBuffer, verifyAssertion, type Alg } from "../security/webauthn";
import { readPasscodeStatus, writeUnlock } from "./state";

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
    return typeof claims.session_id === "string" && /^[0-9a-f-]{36}$/i.test(claims.session_id) ? claims.session_id : null;
  } catch {
    return null;
  }
}

function digestFor(sessionId: string): string {
  return createHash("sha256").update(`passcode-unlock:${sessionId}`).digest("hex");
}

async function current() {
  const session = await resolveSession();
  if (session.state !== "signed-in") return null;
  const { data } = await session.supabase.auth.getSession();
  const sessionId = sessionIdOf(data.session?.access_token);
  return sessionId ? { session, sessionId } : null;
}

export type PasskeyUnlockStart =
  | { state: "ready"; challenge: string; credentialIds: string[]; rpId: string }
  | { state: "none" }
  | { state: "failed" };

/** Whether this member has a key at all, for showing the button. Asks nothing of the device. */
export async function passkeyUnlockOffered(): Promise<boolean> {
  const session = await resolveSession();
  const a = admin();
  if (session.state !== "signed-in" || !a) return false;
  const ids = await listCredentialIds(a, session.user.id);
  return Array.isArray(ids) && ids.length > 0;
}

export async function beginPasskeyUnlock(): Promise<PasskeyUnlockStart> {
  const now = await current();
  const a = admin();
  if (!now || !a) return { state: "failed" };
  const ids = await listCredentialIds(a, now.session.user.id);
  if (ids === null) return { state: "failed" };
  if (ids.length === 0) return { state: "none" };
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

export async function finishPasskeyUnlock(input: unknown): Promise<ActionResult<null>> {
  const parsed = assertionSchema.safeParse(input);
  if (!parsed.success) return fail("rejected");
  const now = await current();
  const a = admin();
  if (!now || !a) return fail("failed");
  const userId = now.session.user.id;
  const paced = await consume({ bucket: "passcode_passkey", subject: subjectForUser(userId), limit: 10, windowSeconds: 900 });
  if (!paced.allowed) return fail("rejected");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const status = await readPasscodeStatus(now.session.supabase as any);
  if (status.state !== "set") return fail("not_set");

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
  const digest = await takeChallenge(a, userId, parsed.data.challenge, "money");
  if (digest !== digestFor(now.sessionId)) return fail("rejected");

  await loose
    .from("money_credentials")
    .update({ sign_count: verdict.signCount, last_used_at: new Date().toISOString() })
    .eq("id", row.id);
  const written = await writeUnlock(userId);
  return written ? ok(null) : fail("failed");
}
