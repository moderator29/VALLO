/**
 * A PASSCODE CHECK THAT DOES NOT GIVE UP ON A WEAK CONNECTION (2 November 2026).
 *
 * It used to send the code once, and a request that timed out or a server
 * that could not reach the database put "That did not go through" under the
 * keypad and emptied it. On a Nigerian 3G signal that is most mornings. Now
 * the same code, under the same attempt id (so the database counts it once),
 * is asked again with growing gaps, and the screen says it is still checking.
 * A real answer (right, wrong, cooldown, signed out) ends it at once; only a
 * lost answer is retried. It gives up after the last gap, or at once when the
 * phone reports no network at all, and says "unreachable": the caller then
 * tries the phone's own check (`local-verifier.ts`) or offers Try again with
 * the code kept.
 */

import type { VerifyResult } from "./actions";

/** The gaps between asks: about 20 seconds in all, then it says so. */
export const RETRY_GAPS_MS: readonly number[] = [1_000, 2_000, 4_000, 6_000, 8_000];

export type PatientResult = VerifyResult | { status: "unreachable" };

export type PatientDeps = {
  verify: (code: string, attemptId: string) => Promise<VerifyResult>;
  isOnline: () => boolean;
  /** Waits `ms`, or less when the network comes back. */
  sleep: (ms: number) => Promise<void>;
  /** Told before each retry, so the screen can say "still checking". */
  onRetry?: (attempt: number) => void;
  gaps?: readonly number[];
};

export async function verifyPatiently(deps: PatientDeps, code: string, attemptId: string): Promise<PatientResult> {
  const gaps = deps.gaps ?? RETRY_GAPS_MS;
  for (let attempt = 0; ; attempt += 1) {
    let lost = false;
    try {
      const result = await deps.verify(code, attemptId);
      if (result.status !== "error") return result;
      lost = true;
    } catch {
      lost = true;
    }
    if (!lost) break;
    if (!deps.isOnline() || attempt >= gaps.length) return { status: "unreachable" };
    deps.onRetry?.(attempt + 1);
    await deps.sleep(gaps[attempt] ?? 0);
    if (!deps.isOnline()) return { status: "unreachable" };
  }
  return { status: "unreachable" };
}

/** A sleep that ends early when the browser says the network is back. */
export function sleepUntilOnline(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      setTimeout(resolve, ms);
      return;
    }
    const done = () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", done);
      resolve();
    };
    const timer = window.setTimeout(done, ms);
    window.addEventListener("online", done);
  });
}
