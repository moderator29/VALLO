"use server";

/**
 * THE LOCK ON MONEY, AS THE SCREENS CALL IT. V-81.
 *
 * Codes, not sentences: the client maps them onto `platform.moneyLock`. Every
 * door authorises off the signed-in session and hands the checking to
 * `money-step-up.ts`, which is the only code that writes the three tables.
 * Every proof is for ONE action, named by its intent (`money-intent.ts`).
 *
 * The fallback proof is the one re-authentication door the account deletion
 * flow uses (`lib/account-deletion/reauthenticate.ts`): the password for an
 * account that has one, an emailed code for one that signed up with Google.
 * The password is refused for a day after it changes, because today any
 * signed-in session can change it (reported to the audit).
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, ok, type ActionResult } from "../actions/envelope";
import { resolveSession } from "../actions/session";
import { reauthenticate, reauthMethodFor, sendReauthCode, type ReauthMethod } from "../account-deletion/reauthenticate";
import { consume, subjectForUser } from "./rate-limit";
import { isMoneyIntent, type MoneyIntent } from "./money-intent";
import {
  admin,
  ceremonyOrigin,
  consumeStepUp,
  enrolKey,
  intentDigest,
  isStaffAccount,
  listConsoleCredentialIds,
  listCredentialIds,
  mintChallenge,
  passwordChangedRecently,
  proveWithAssertion,
  recordStepUp,
  spendEmailCodeMarker,
} from "./money-step-up";

export type StepUpStatus = { needed: boolean; credentialIds: string[]; rpId: string; fallback: ReauthMethod };

/**
 * Does this person's money need a proof, and which keys may give it? Null
 * when that cannot be read: the phone then submits and the server decides.
 */
export async function stepUpStatus(): Promise<StepUpStatus | null> {
  const session = await resolveSession();
  const a = admin();
  const { rpId } = await ceremonyOrigin();
  if (session.state !== "signed-in" || !a) return null;
  const ids = await listCredentialIds(a, session.user.id);
  if (ids === null) return null;
  return { needed: ids.length > 0, credentialIds: ids, rpId, fallback: reauthMethodFor(session.user) };
}

export async function beginMoneyConfirm(intent: unknown): Promise<ActionResult<{ challenge: string }>> {
  if (!isMoneyIntent(intent)) return fail("rejected");
  const session = await resolveSession();
  const a = admin();
  if (session.state !== "signed-in" || !a) return fail("failed");
  const challenge = await mintChallenge(a, session.user.id, "money", intentDigest(intent));
  return challenge ? ok({ challenge }) : fail("failed");
}

const assertionSchema = z.object({
  challenge: z.string().min(20).max(200),
  credentialId: z.string().min(16).max(1400),
  clientDataJSON: z.string().min(10).max(4000),
  authenticatorData: z.string().min(10).max(4000),
  signature: z.string().min(10).max(2000),
});

export async function finishMoneyConfirm(input: unknown): Promise<ActionResult<{ stepUp: string }>> {
  const parsed = assertionSchema.safeParse(input);
  if (!parsed.success) return fail("rejected");
  const session = await resolveSession();
  const a = admin();
  if (session.state !== "signed-in" || !a) return fail("failed");
  const id = await proveWithAssertion(a, { userId: session.user.id, ...parsed.data });
  return id ? ok({ stepUp: id }) : fail("rejected");
}

/* A guess through any fallback door counts against one allowance, so the
   lock is not a way to try passwords or codes faster than sign-in allows. */
async function attemptAllowed(userId: string): Promise<boolean> {
  const verdict = await consume({ bucket: "money_lock_password", subject: subjectForUser(userId), limit: 5, windowSeconds: 900 });
  /* A limiter that could not count is not a limit: closed, for guesses. */
  return verdict.allowed && !verdict.degraded;
}

const proofSchema = z.object({
  password: z.string().max(200).optional(),
  code: z.string().trim().regex(/^\d{6,10}$/).optional(),
});

type FallbackError = "rejected" | "failed" | "password_recent";

/** Check the fallback proof: the password (not within a day of a change) or an emailed code. */
async function fallbackProven(
  user: Parameters<typeof reauthenticate>[0],
  proof: z.infer<typeof proofSchema>,
): Promise<true | FallbackError> {
  const a = admin();
  if (!a) return "failed";
  if (!(await attemptAllowed(user.id))) return "rejected";
  if ((proof.password ?? "").length > 0) {
    if (await passwordChangedRecently(a, user.id)) return "password_recent";
    return (await reauthenticate(user, { password: proof.password })) ? true : "rejected";
  }
  if ((proof.code ?? "").length > 0) {
    /* Only with a code requested from this lock (advisory: see
       spendEmailCodeMarker). The marker is spent after the code checks out. */
    const code = proof.code;
    return (await spendEmailCodeMarker(a, user.id, () => reauthenticate(user, { emailCode: code }))) ? true : "rejected";
  }
  return "rejected";
}

/** An emailed code, for an account with no password or a phone whose sensor will not answer. */
export async function sendFallbackCode(): Promise<ActionResult<null>> {
  const session = await resolveSession();
  if (session.state !== "signed-in") return fail("failed");
  const a = admin();
  if (!a || !(await attemptAllowed(session.user.id))) return fail("failed");
  /* The marker first: the code this sends is good for the lock only with it. */
  if (!(await mintChallenge(a, session.user.id, "email_code"))) return fail("failed");
  return (await sendReauthCode(session.user)) ? ok(null) : fail("failed");
}

/** The fallback: the password or an emailed code, for one action. */
export async function confirmWithFallback(input: unknown): Promise<ActionResult<{ stepUp: string }>> {
  const parsed = z.object({ proof: proofSchema, intent: z.unknown() }).safeParse(input);
  if (!parsed.success || !isMoneyIntent(parsed.data.intent)) return fail("rejected");
  const intent: MoneyIntent = parsed.data.intent;
  const session = await resolveSession();
  const a = admin();
  if (session.state !== "signed-in" || !a) return fail("failed");
  const proven = await fallbackProven(session.user, parsed.data.proof);
  if (proven !== true) return fail(proven);
  const method = (parsed.data.proof.password ?? "").length > 0 ? "password" : "email_code";
  const id = await recordStepUp(a, session.user.id, method, intentDigest(intent));
  return id ? ok({ stepUp: id }) : fail("failed");
}

const enrolProofSchema = proofSchema.extend({ stepUp: z.string().uuid().optional() });

/**
 * A STAFF ACCOUNT'S KEYS ALSO OPEN THE CONSOLE, so a stolen password must
 * never be enough to add one:
 *  - with a key already enrolled, another is added only on a proof made WITH
 *    an existing key (a step-up for `add_lock`, never the password);
 *  - the first key takes the emailed code AND, for an account with one, the
 *    password: the inbox and the password together.
 * Every staff key added or removed is also audited and announced to the
 * holder and every super admin by the database
 * (`private.announce_staff_key_change`).
 */
async function staffEnrolProven(
  a: NonNullable<ReturnType<typeof admin>>,
  user: Parameters<typeof reauthenticate>[0],
  proof: z.infer<typeof enrolProofSchema>,
): Promise<true | FallbackError> {
  /* C14: a key revoked for the console (a lost phone, cleared by a second
     super admin, audited) cannot vouch for a new one, so it does not count:
     a staff member with none left takes the first-key proof. */
  const keys = await listConsoleCredentialIds(a, user.id);
  if (keys === null) return "failed";
  if (keys.length > 0) {
    if (!proof.stepUp) return "rejected";
    return (await consumeStepUp(a, user.id, proof.stepUp, intentDigest({ kind: "add_lock" }), true)) ? true : "rejected";
  }
  if (!(await attemptAllowed(user.id))) return "rejected";
  const code = proof.code ?? "";
  if (code.length === 0) return "rejected";
  if (reauthMethodFor(user) === "password") {
    if ((proof.password ?? "").length === 0) return "rejected";
    if (await passwordChangedRecently(a, user.id)) return "password_recent";
    if (!(await reauthenticate(user, { password: proof.password }))) return "rejected";
  }
  return (await spendEmailCodeMarker(a, user.id, () => reauthenticate(user, { emailCode: code }))) ? true : "rejected";
}

/** Enrolling starts with the fallback proof, so a thief with an open session cannot. */
export async function beginEnrol(
  proof: unknown,
): Promise<ActionResult<{ challenge: string; userId: string; email: string; rpId: string }>> {
  const parsed = enrolProofSchema.safeParse(proof);
  if (!parsed.success) return fail("rejected");
  const session = await resolveSession();
  const a = admin();
  if (session.state !== "signed-in" || !a || !session.user.email) return fail("failed");
  const proven = (await isStaffAccount(a, session.user.id))
    ? await staffEnrolProven(a, session.user, parsed.data)
    : await fallbackProven(session.user, parsed.data);
  if (proven !== true) return fail(proven);
  const challenge = await mintChallenge(a, session.user.id, "enrol");
  const { rpId } = await ceremonyOrigin();
  return challenge ? ok({ challenge, userId: session.user.id, email: session.user.email, rpId }) : fail("failed");
}

const enrolSchema = z.object({
  challenge: z.string().min(20).max(200),
  credentialId: z.string().min(16).max(1400),
  clientDataJSON: z.string().min(10).max(4000),
  publicKey: z.string().min(40).max(2000),
  alg: z.number().int(),
  label: z.string().trim().max(60).nullable(),
});

export async function finishEnrol(input: unknown): Promise<ActionResult<null>> {
  const parsed = enrolSchema.safeParse(input);
  if (!parsed.success) return fail("rejected");
  const session = await resolveSession();
  const a = admin();
  if (session.state !== "signed-in" || !a) return fail("failed");
  const result = await enrolKey(a, { userId: session.user.id, ...parsed.data });
  if (result !== "ok") return fail(result);
  revalidatePath("/settings/privacy");
  return ok(null);
}

/** Removing a key is itself a money-lock change, so it needs a proof for exactly that. */
export async function removeMoneyCredential(input: unknown): Promise<ActionResult<null>> {
  const parsed = z.object({ id: z.string().uuid(), stepUp: z.string().uuid() }).safeParse(input);
  if (!parsed.success) return fail("rejected");
  const session = await resolveSession();
  const a = admin();
  if (session.state !== "signed-in" || !a) return fail("failed");
  const digest = intentDigest({ kind: "remove_lock", target: parsed.data.id });
  /* A staff account's key is removed only on a proof made with a key. */
  const keyOnly = await isStaffAccount(a, session.user.id);
  if (!(await consumeStepUp(a, session.user.id, parsed.data.stepUp, digest, keyOnly))) return fail("rejected");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (a as any).from("money_credentials").delete().eq("id", parsed.data.id).eq("user_id", session.user.id);
  if (error) return fail("failed");
  revalidatePath("/settings/privacy");
  return ok(null);
}
