"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { consume, ipFromHeaders, subjectForIp, subjectForUser } from "../security/rate-limit";
import { safeReturnPath } from "../security/return-path";
import { parseVerify, type VerifyOutcome } from "./decide";
import { attemptsLeft, isPasscodeLength, isWellFormed, setupRefusal, type PasscodeLength } from "./rules";
import {
  clearResetIntent,
  clearUnlock,
  readPasscodeSession,
  writeResetIntent,
  writeUnlock,
} from "./state";
import { passcodeKey, RESET_INTENT_SECONDS, signResetIntent } from "./unlock-cookie";

/**
 * THE PASSCODE'S SERVER ACTIONS: set (first, change, reset), verify, lock and
 * "use your password instead". docs/PASSCODE.md is the design.
 *
 * Every rule that matters is enforced by the database functions in
 * `20260929034124_passcode_member_app_lock_code_bcrypt_only.sql`; these
 * actions add the per-user and per-address pacing, write the signed unlock
 * cookie, and sign the member out when the database says ten wrong attempts
 * have been made. A code is never logged, echoed back or stored here.
 */

export type SetPasscodeResult =
  | { ok: true; event: "set" | "change" | "reset" }
  | {
      ok: false;
      reason: "signed-out" | "length" | "trivial" | "mismatch" | "proof_required" | "current" | "paced" | "error" | "locked-out";
      /** For `current`: what the current-code attempt counted. */
      attempt?: VerifyResult;
      retryAfterSeconds?: number;
    };

export type VerifyResult =
  | { status: "ok" }
  | { status: "wrong"; beforeCooldown: number; beforeSignOut: number }
  | { status: "cooldown"; retryAfterSeconds: number }
  | { status: "signed-out" }
  | { status: "setup" }
  | { status: "paced"; retryAfterSeconds: number }
  | { status: "error" };

/* Generous for a person, tight for a script: the database's own count ends
   a guessing run at ten anyway; this stops one address spraying many accounts. */
const VERIFY_PER_USER = { bucket: "passcode_verify_user", limit: 30, windowSeconds: 10 * 60 };
const VERIFY_PER_IP = { bucket: "passcode_verify_ip", limit: 120, windowSeconds: 10 * 60 };
const SET_PER_USER = { bucket: "passcode_set_user", limit: 12, windowSeconds: 60 * 60 };

async function callerIp(): Promise<string> {
  try {
    return ipFromHeaders(await headers());
  } catch {
    return "local";
  }
}

async function paced(userId: string, rules: { bucket: string; limit: number; windowSeconds: number }[]): Promise<number | null> {
  const ip = await callerIp();
  for (const rule of rules) {
    const subject = rule.bucket.endsWith("_ip") ? subjectForIp(ip) : subjectForUser(userId);
    const verdict = await consume({ ...rule, subject });
    if (!verdict.allowed) return verdict.retryAfterSeconds;
  }
  return null;
}

function toVerifyResult(outcome: VerifyOutcome): VerifyResult {
  switch (outcome.status) {
    case "ok":
      return { status: "ok" };
    case "wrong": {
      const left = attemptsLeft(outcome.failedCount);
      return { status: "wrong", beforeCooldown: left.beforeCooldown, beforeSignOut: left.beforeSignOut };
    }
    case "cooldown":
      return { status: "cooldown", retryAfterSeconds: outcome.retryAfterSeconds };
    case "reset_required":
      return { status: "signed-out" };
    case "unset":
      return { status: "setup" };
    default:
      return { status: "error" };
  }
}

/** Ten wrong attempts: this browser is signed out, and a full sign-in is the only way back. */
async function endThisSession(): Promise<void> {
  const session = await readPasscodeSession();
  await clearUnlock();
  if (session.state === "signed-in") {
    try {
      await session.supabase.auth.signOut({ scope: "local" });
    } catch {
      /* The passcode is already unusable; the next request finds reset_required. */
    }
  }
  revalidatePath("/", "layout");
}

const ATTEMPT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `attemptId` (2 November 2026): one id per typed code, so the lock can ask
 * again on a weak connection without the same code being counted twice
 * (`public.passcode_verify(p_code, p_attempt)`).
 */
export async function verifyPasscodeAction(code: string, attemptId?: string): Promise<VerifyResult> {
  const session = await readPasscodeSession();
  if (session.state !== "signed-in") return { status: "signed-out" };
  if (typeof code !== "string" || !(isWellFormed(code, 6) || isWellFormed(code, 4))) {
    return { status: "wrong", ...attemptsLeft(0) };
  }

  const wait = await paced(session.userId, [VERIFY_PER_USER, VERIFY_PER_IP]);
  if (wait !== null) return { status: "paced", retryAfterSeconds: wait };

  let outcome: VerifyOutcome;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (session.supabase as any).rpc(
      "passcode_verify",
      typeof attemptId === "string" && ATTEMPT_ID.test(attemptId) ? { p_code: code, p_attempt: attemptId } : { p_code: code },
    );
    outcome = error ? { status: "error" } : parseVerify(data);
  } catch {
    outcome = { status: "error" };
  }

  if (outcome.status === "ok") {
    await writeUnlock(session.userId);
    return { status: "ok" };
  }
  if (outcome.status === "reset_required") {
    await endThisSession();
    return { status: "signed-out" };
  }
  return toVerifyResult(outcome);
}

export async function setPasscodeAction(input: {
  code: string;
  confirm: string;
  length: number;
  current?: string | null;
}): Promise<SetPasscodeResult> {
  const session = await readPasscodeSession();
  if (session.state !== "signed-in") return { ok: false, reason: "signed-out" };

  const length: PasscodeLength | null = isPasscodeLength(input?.length) ? input.length : null;
  if (!length || typeof input.code !== "string" || typeof input.confirm !== "string") return { ok: false, reason: "length" };
  const refusal = setupRefusal(input.code, input.confirm, length);
  if (refusal) return { ok: false, reason: refusal };
  const current = typeof input.current === "string" && input.current.length > 0 ? input.current : null;
  if (current !== null && !(isWellFormed(current, 6) || isWellFormed(current, 4))) {
    return { ok: false, reason: "current", attempt: { status: "wrong", ...attemptsLeft(0) } };
  }

  const wait = await paced(session.userId, [SET_PER_USER]);
  if (wait !== null) return { ok: false, reason: "paced", retryAfterSeconds: wait };

  let data: unknown = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const answer = await (session.supabase as any).rpc("passcode_set", { p_code: input.code, p_length: length, p_current: current });
    if (answer.error) return { ok: false, reason: "error" };
    data = answer.data;
  } catch {
    return { ok: false, reason: "error" };
  }

  const row = (data ?? {}) as { ok?: unknown; event?: unknown; reason?: unknown; attempt?: unknown };
  if (row.ok === true && (row.event === "set" || row.event === "change" || row.event === "reset")) {
    await writeUnlock(session.userId);
    await clearResetIntent();
    return { ok: true, event: row.event };
  }
  switch (row.reason) {
    case "trivial":
      return { ok: false, reason: "trivial" };
    case "invalid":
      return { ok: false, reason: "length" };
    case "proof_required":
      return { ok: false, reason: "proof_required" };
    case "current": {
      const attempt = parseVerify(row.attempt);
      if (attempt.status === "reset_required") {
        await endThisSession();
        return { ok: false, reason: "locked-out" };
      }
      return { ok: false, reason: "current", attempt: toVerifyResult(attempt) };
    }
    default:
      return { ok: false, reason: "error" };
  }
}

/** The browser locked itself (idle, hidden, a new tab): the server forgets the unlock too. */
export async function lockPasscodeAction(): Promise<void> {
  await clearUnlock();
}

/**
 * "Use your password instead". Remember, on this browser and for this
 * member, that a new code is wanted; sign out; send them to sign in. After a
 * full sign-in (a fresh `amr`), the gate offers the setup screen and
 * `passcode_set` accepts a new code without the old one.
 */
export async function forgotPasscodeAction(next?: string | null): Promise<never> {
  const session = await readPasscodeSession();
  if (session.state === "signed-in") {
    const key = passcodeKey("reset");
    if (key) await writeResetIntent(signResetIntent(key, session.userId, Math.floor(Date.now() / 1000)), RESET_INTENT_SECONDS);
    await endThisSession();
  }
  const back = typeof next === "string" ? safeReturnPath(next, "") : null;
  const query = new URLSearchParams({ notice: "passcode-reset" });
  if (back) query.set("next", back);
  redirect(`/sign-in?${query.toString()}`);
}
