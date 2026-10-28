"use client";

import { useCallback, useTransition } from "react";
import { toast } from "./toast";

/**
 * `useTransition` THAT CANNOT TAKE THE SCREEN DOWN (27 October 2026 audit).
 *
 * In React 19 an async transition whose function throws, a server action that
 * lost its connection halfway for instance, rethrows into the nearest error
 * boundary: the person lost the screen they were on for a request that simply
 * did not arrive. About a hundred call sites wrote
 * `startTransition(async () => { const r = await action(); ... })` with no
 * `catch`, which is that failure waiting for a bad signal.
 *
 * This is the same hook with the same shape (`[pending, start]`), so a call
 * site changes one word. A throw inside the function is caught, said once in a
 * toast ("did not go through, nothing was lost"), and the screen stays exactly
 * where it was with its state intact. A site that does its own `try` and
 * `catch` is unaffected: its error never reaches here.
 *
 * The function may be async or plain. Updates made after an `await` keep the
 * behaviour they always had (they are not part of the transition in React 19).
 */
export const TRANSITION_FAILED = "That did not go through. Check your connection and try again.";

export function useSafeTransition(): [boolean, (scope: () => unknown) => void] {
  const [pending, start] = useTransition();
  const safe = useCallback(
    (scope: () => unknown) => {
      start(async () => {
        try {
          await scope();
        } catch {
          toast(TRANSITION_FAILED, { tone: "error" });
        }
      });
    },
    [start],
  );
  return [pending, safe];
}
