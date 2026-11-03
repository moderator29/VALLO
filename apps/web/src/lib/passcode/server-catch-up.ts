"use client";

import type { VerifyResult } from "./actions";
import { forgetLocalPasscode } from "./local-verifier";
import { RETRY_GAPS_MS, sleepUntilOnline, verifyPatiently } from "./patient-verify";

/**
 * AFTER AN UNLOCK ON THE PHONE, THE SERVER CATCHES UP (2 November 2026).
 *
 * A code checked on the phone (`local-verifier.ts`) shows the page that was
 * already here and nothing else: the server has written no unlock, so money
 * still refuses. This keeps that one typed code in memory, for this tab only
 * and for ten minutes at most, and sends it to the server as soon as the
 * signal is back, which writes the unlock cookie and refreshes the route on
 * its own. If the server says the code is wrong (it was changed on another
 * device), the phone's verifier is forgotten and the page locks again.
 */

const HOLD_MS = 10 * 60 * 1000;
export const LOCK_AGAIN_EVENT = "vallo:passcode-lock-again";

let pending: { code: string; until: number } | null = null;
let running = false;

function newAttemptId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return "00000000-0000-4000-8000-" + String(Date.now()).padStart(12, "0").slice(-12);
  }
}

export function catchUpWithServer(code: string, verify: (code: string, attemptId?: string) => Promise<VerifyResult>): void {
  pending = { code, until: Date.now() + HOLD_MS };
  if (running) return;
  running = true;
  void (async () => {
    try {
      while (pending && Date.now() < pending.until) {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          await sleepUntilOnline(30_000);
          continue;
        }
        const attempt = pending;
        const result = await verifyPatiently(
          {
            verify: (c, id) => verify(c, id),
            isOnline: () => (typeof navigator === "undefined" ? true : navigator.onLine !== false),
            sleep: sleepUntilOnline,
            gaps: RETRY_GAPS_MS,
          },
          attempt.code,
          newAttemptId(),
        );
        if (result.status === "ok") break;
        if (result.status === "wrong" || result.status === "signed-out" || result.status === "cooldown" || result.status === "setup") {
          forgetLocalPasscode();
          window.dispatchEvent(new Event(LOCK_AGAIN_EVENT));
          break;
        }
        await sleepUntilOnline(15_000);
      }
    } finally {
      pending = null;
      running = false;
    }
  })();
}
