import { isNetworkError } from "./use-offline";
import { sleepUntilOnline } from "../passcode/patient-verify";

/**
 * Ask again when the ANSWER was lost, never when it was a "no" (3 November 2026).
 * Only for a call the server treats as safe to repeat (a code that counts once:
 * `confirmPhoneCode` answers "confirmed" to a spent code on a confirmed number).
 * Gaps grow, and the wait ends early when the phone reports signal.
 */
export const LOST_ANSWER_GAPS_MS: readonly number[] = [1_000, 3_000, 6_000];

export async function retryLost<T>(
  call: () => Promise<T>,
  options: { gaps?: readonly number[]; sleep?: (ms: number) => Promise<void>; onRetry?: () => void } = {},
): Promise<T> {
  const gaps = options.gaps ?? LOST_ANSWER_GAPS_MS;
  const sleep = options.sleep ?? sleepUntilOnline;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await call();
    } catch (error) {
      if (!isNetworkError(error) || attempt >= gaps.length) throw error;
      options.onRetry?.();
      await sleep(gaps[attempt] ?? 0);
    }
  }
}
