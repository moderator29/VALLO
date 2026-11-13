/**
 * AN ANSWER, OR NOTHING AFTER `ms` (SPEED, 13 November 2026).
 *
 * The lock's taps (the passcode check, the Face ID challenge and proof) used
 * to wait for a server action for as long as the request stayed open, so a
 * stalled server left a spinner with no end. Each wait now goes through this:
 * the answer if it arrives in time, `NO_ANSWER` otherwise. The late answer
 * (or a late failure) is dropped, never thrown, and the timer is always
 * cleared. Client safe and pure, so it is a unit test.
 */
export const NO_ANSWER: unique symbol = Symbol("no answer");

export function withinMs<T>(work: Promise<T>, ms: number): Promise<T | typeof NO_ANSWER> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  /* A late rejection of an abandoned wait must not surface unhandled. */
  work.catch(() => undefined);
  const late = new Promise<typeof NO_ANSWER>((resolve) => {
    timer = setTimeout(() => resolve(NO_ANSWER), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}
