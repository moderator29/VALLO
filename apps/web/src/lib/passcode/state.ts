import "server-only";

import { cache } from "react";
import { cookies, headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveSessionClaims } from "../actions/session";
import { serverCookiesSecure } from "../supabase/cookie-policy";
import { decideGate, parseStatus, type GateView, type PasscodeStatus } from "./decide";
import { FRESH_RESET_SECONDS, FRESH_UNLOCK_SECONDS, isFreshSignIn } from "./rules";
import {
  passcodeCookieOptions,
  passcodeKey,
  readResetIntent,
  readUnlock,
  RESET_INTENT_COOKIE,
  signUnlock,
  UNLOCK_COOKIE,
  type UnlockClaims,
} from "./unlock-cookie";

/**
 * THE PASSCODE STATE OF THIS REQUEST, READ ONCE.
 *
 * The (app) layout, a money action and the touch route all ask the same
 * question, so the answer is memoised per request with React's `cache`.
 * The caller is identified the way the shell identifies it
 * (`resolveSessionClaims`, a verified token), and the `amr` claim comes from
 * the same verified token, never from an unverified cookie.
 */

export type PasscodeSession =
  | { state: "signed-out" }
  | { state: "signed-in"; userId: string; supabase: SupabaseClient; amr: unknown };

export const readPasscodeSession = cache(async function readPasscodeSession(): Promise<PasscodeSession> {
  const session = await resolveSessionClaims();
  if (session.state !== "signed-in") return { state: "signed-out" };
  let amr: unknown = null;
  try {
    const { data } = await session.supabase.auth.getClaims();
    amr = (data?.claims as { amr?: unknown } | undefined)?.amr ?? null;
  } catch {
    amr = null;
  }
  return { state: "signed-in", userId: session.userId, supabase: session.supabase as unknown as SupabaseClient, amr };
});

/**
 * `public.passcode_status()`, as the member. Any failure is `error`, which the
 * gate answers with the lock and a password fallback, never with the page.
 * The functions are newer than `database.types.ts`, hence the loose call.
 */
/** Did this session sign in within `windowSeconds`, by the verified `amr`? */
export function sessionSignedInWithin(session: PasscodeSession, windowSeconds: number): boolean {
  return session.state === "signed-in" && isFreshSignIn(session.amr, Math.floor(Date.now() / 1000), windowSeconds);
}

export async function readPasscodeStatus(supabase: SupabaseClient, options: { waitMs?: number } = {}): Promise<PasscodeStatus> {
  try {
    /* `waitMs` (SPEED, 13 November 2026): a caller in front of a tap (the
       Face ID proof) ends the read after that long, and the answer is
       `error`, which never opens anything. The layout's gate keeps the
       server client's own deadline: there an early `error` would draw the
       lock for a member who never set a passcode. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (supabase as any).rpc("passcode_status");
    const { data, error } = await (options.waitMs && typeof call?.abortSignal === "function"
      ? call.abortSignal(AbortSignal.timeout(options.waitMs))
      : call);
    if (error) return { state: "error" };
    return parseStatus(data);
  } catch {
    return { state: "error" };
  }
}

export type GateResolution = { view: GateView; userId: string | null; unlock: UnlockClaims | null };

export const resolvePasscodeGate = cache(async function resolvePasscodeGate(): Promise<GateResolution> {
  const session = await readPasscodeSession();
  if (session.state !== "signed-in") return { view: { kind: "open" }, userId: null, unlock: null };

  const nowSeconds = Math.floor(Date.now() / 1000);
  const jar = await cookies();
  const unlockKey = passcodeKey("unlock");
  const resetKey = passcodeKey("reset");
  const unlock = unlockKey ? readUnlock(unlockKey, jar.get(UNLOCK_COOKIE)?.value, session.userId, nowSeconds) : null;
  const resetIntent = resetKey ? readResetIntent(resetKey, jar.get(RESET_INTENT_COOKIE)?.value, session.userId, nowSeconds) : false;
  const status = await readPasscodeStatus(session.supabase);

  const view = decideGate({
    signedIn: true,
    status,
    unlockCookieValid: unlock !== null,
    freshUnlock: isFreshSignIn(session.amr, nowSeconds, FRESH_UNLOCK_SECONDS),
    freshReset: isFreshSignIn(session.amr, nowSeconds, FRESH_RESET_SECONDS),
    resetIntent,
  });
  return { view, userId: session.userId, unlock };
});

async function secureCookies(): Promise<boolean> {
  try {
    return serverCookiesSecure((await headers()).get("x-forwarded-proto"));
  } catch {
    return serverCookiesSecure(null);
  }
}

/**
 * Write (or slide) the unlock. Only from a server action or a route handler:
 * a server component cannot set a cookie. False when there is no key.
 */
export async function writeUnlock(userId: string, issuedAt?: number): Promise<boolean> {
  const key = passcodeKey("unlock");
  if (!key) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  const jar = await cookies();
  jar.set(UNLOCK_COOKIE, signUnlock(key, userId, nowSeconds, issuedAt ?? nowSeconds), passcodeCookieOptions(await secureCookies()));
  return true;
}

export async function clearUnlock(): Promise<void> {
  const jar = await cookies();
  jar.set(UNLOCK_COOKIE, "", passcodeCookieOptions(await secureCookies(), 0));
}

export async function writeResetIntent(value: string, maxAge: number): Promise<void> {
  const jar = await cookies();
  jar.set(RESET_INTENT_COOKIE, value, passcodeCookieOptions(await secureCookies(), maxAge));
}

export async function clearResetIntent(): Promise<void> {
  const jar = await cookies();
  jar.set(RESET_INTENT_COOKIE, "", passcodeCookieOptions(await secureCookies(), 0));
}
