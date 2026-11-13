import { isPasscodeLength, type PasscodeLength } from "./rules";

/**
 * WHAT THE GATE SHOWS, DECIDED FROM FACTS THE SERVER HAS ALREADY READ.
 *
 * Pure, so every branch is a unit test (`decide.test.ts`) rather than a
 * browser walk. The one rule that shapes all of it: the gate may fall back to
 * a PASSWORD SIGN-IN, and never to skipping the lock. An unreadable passcode
 * table shows the lock with "Use your password instead"; only a full sign-in
 * in the last five minutes (the password was just typed) or a valid unlock
 * cookie lets the member through.
 */

export type PasscodeStatus =
  | { state: "unset" }
  | { state: "set" | "reset_required"; length: PasscodeLength; failedCount: number; lockedUntil: string | null }
  | { state: "error" };

export type GateFacts = {
  signedIn: boolean;
  status: PasscodeStatus;
  /** A valid `vallo_unlock` for this user. */
  unlockCookieValid: boolean;
  /** Signed in (any method) within FRESH_UNLOCK_SECONDS. */
  freshUnlock: boolean;
  /** Signed in within FRESH_RESET_SECONDS: may set a new code without the old one. */
  freshReset: boolean;
  /** The member chose "Use your password instead" on this browser. */
  resetIntent: boolean;
};

export type LockMode =
  /** The keypad. */
  | "code"
  /** Ten wrong attempts: only a full sign-in, then a new code. */
  | "password-only"
  /** The passcode could not be read: the keypad is offered, and the password beside it. */
  | "unavailable";

export type GateView =
  | { kind: "open" }
  /**
   * Signed in, no passcode set. THE PASSCODE IS OFF BY DEFAULT (founder, 6 and
   * 13 November 2026): the page shows and nothing asks. A passcode is turned on
   * in Settings, Passcode only; the dashboard alert that offered one was removed.
   */
  | { kind: "unset" }
  /** `mint`: the page may show, and the browser should ask for an unlock cookie now. */
  | { kind: "unlocked"; mint: boolean; length: PasscodeLength }
  | { kind: "setup"; mode: "first" | "reset" }
  | { kind: "locked"; mode: LockMode; length: PasscodeLength; failedCount: number; lockedUntil: string | null };

export function decideGate(facts: GateFacts): GateView {
  if (!facts.signedIn) return { kind: "open" };
  const { status } = facts;

  if (status.state === "error") {
    if (facts.unlockCookieValid) return { kind: "unlocked", mint: false, length: 6 };
    if (facts.freshUnlock) return { kind: "unlocked", mint: true, length: 6 };
    return { kind: "locked", mode: "unavailable", length: 6, failedCount: 0, lockedUntil: null };
  }

  if (status.state === "unset") return { kind: "unset" };

  if (status.state === "reset_required") {
    if (facts.freshReset) return { kind: "setup", mode: "reset" };
    return { kind: "locked", mode: "password-only", length: status.length, failedCount: status.failedCount, lockedUntil: null };
  }

  if (facts.resetIntent && facts.freshReset) return { kind: "setup", mode: "reset" };
  if (facts.unlockCookieValid) return { kind: "unlocked", mint: false, length: status.length };
  if (facts.freshUnlock) return { kind: "unlocked", mint: true, length: status.length };
  return {
    kind: "locked",
    mode: "code",
    length: status.length,
    failedCount: status.failedCount,
    lockedUntil: status.lockedUntil,
  };
}

/**
 * May money move on this session? Only when unlocked, or when no passcode has
 * been set (a stolen session could set the first code anyway, so refusing
 * proves nothing; money screens keep their own lock, `MoneyLockGroup`). A
 * reset in progress, a lock and an unreadable table all refuse.
 */
export function moneyAllowed(view: GateView): boolean {
  if (view.kind === "unlocked" || view.kind === "unset") return true;
  return view.kind === "setup" && view.mode === "first";
}

/** Read `public.passcode_status()`'s answer. Anything unexpected is an error, never "unset". */
export function parseStatus(data: unknown): PasscodeStatus {
  if (!data || typeof data !== "object") return { state: "error" };
  const row = data as Record<string, unknown>;
  if (row.state === "unset") return { state: "unset" };
  if (row.state !== "set" && row.state !== "reset_required") return { state: "error" };
  const length = Number(row.length);
  if (!isPasscodeLength(length)) return { state: "error" };
  const failed = Number(row.failed_count ?? 0);
  return {
    state: row.state,
    length,
    failedCount: Number.isFinite(failed) && failed >= 0 ? Math.floor(failed) : 0,
    lockedUntil: typeof row.locked_until === "string" ? row.locked_until : null,
  };
}

export type VerifyOutcome =
  | { status: "ok" }
  | { status: "wrong"; failedCount: number }
  | { status: "cooldown"; retryAfterSeconds: number; failedCount: number }
  | { status: "reset_required" }
  | { status: "unset" }
  | { status: "error" };

/** Read `public.passcode_verify()`'s answer. */
export function parseVerify(data: unknown): VerifyOutcome {
  if (!data || typeof data !== "object") return { status: "error" };
  const row = data as Record<string, unknown>;
  const failed = Math.max(0, Math.floor(Number(row.failed_count ?? 0)) || 0);
  switch (row.status) {
    case "ok":
      return { status: "ok" };
    case "wrong":
      return { status: "wrong", failedCount: failed };
    case "cooldown": {
      const seconds = Math.floor(Number(row.retry_after_seconds));
      return { status: "cooldown", retryAfterSeconds: Number.isFinite(seconds) && seconds > 0 ? seconds : 30, failedCount: failed };
    }
    case "reset_required":
      return { status: "reset_required" };
    case "unset":
      return { status: "unset" };
    default:
      return { status: "error" };
  }
}
